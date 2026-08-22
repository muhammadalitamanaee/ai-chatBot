export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  saveMessage,
  touchThread,
  renameThread,
  getMessagesByThread,
  getUserSettings,
} from "@/db/queries";
import type { ChatRequest, ChatStreamEvent, MessageMeta } from "@/types/index";
import { runAgent, buildGroundedPrompt, type AnswerDepth } from "@/lib/agent";
import { tryStream, withFallback } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rateLimit";
import { logEvent } from "@/lib/log";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const startTime = Date.now();

  try {
    const rl = await checkRateLimit(session.user.id);
    if (!rl.allowed) {
      return new Response(
        `بیش از حد مجاز درخواست دادی. بعد از ${rl.retryAfterSec} ثانیه دوباره تلاش کن.`,
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const body: ChatRequest = await req.json();
    if (!body.messages?.length || !body.threadId) {
      return new Response("درخواست نامعتبر است.", { status: 400 });
    }

    const { messages: chatMessages, threadId } = body;
    const userMessage = chatMessages.at(-1)!;
    const userSettings = await getUserSettings(session.user.id);
    const answerDepth: AnswerDepth =
      userSettings?.answerDepth === "professional" ? "professional" : "beginner";
    const customPrompt = userSettings?.systemPrompt?.trim();

    await saveMessage({ threadId, role: "user", content: userMessage.content });
    const existingMessages = await getMessagesByThread(threadId, session.user.id);
    if (existingMessages.length === 1) {
      const title =
        userMessage.content.length > 40
          ? `${userMessage.content.slice(0, 40).trimEnd()}...`
          : userMessage.content;
      await renameThread(threadId, title, session.user.id);
    }

    const history: ChatCompletionMessageParam[] = chatMessages
      .slice(0, -1)
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

    const encoder = new TextEncoder();
    const event = (value: ChatStreamEvent) => encoder.encode(`${JSON.stringify(value)}\n`);

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let text = "";
        let modelUsed = "";
        let metadata: MessageMeta = {};

        const emit = (value: ChatStreamEvent) => controller.enqueue(event(value));

        try {
          emit({ type: "status", message: "در حال بررسی درخواست…" });

          const outcome = await runAgent({
            question: userMessage.content,
            history,
            answerDepth,
            onStep(step) {
              emit({ type: "step", step });
            },
          });

          logEvent("agent.outcome", {
            kind: outcome.kind,
            usesTools: outcome.usesTools,
            steps: outcome.steps.length,
            evidence: outcome.evidence.length,
            tookMs: Date.now() - startTime,
          });

          const sources = outcome.evidence.map((e) => ({
            title: e.title,
            url: e.sourceUrl,
          }));
          metadata = {
            sources,
            steps: outcome.steps,
            agentic: outcome.usesTools || outcome.kind === "ask",
          };

          if (outcome.kind === "ask") {
            text = outcome.question ?? "برای ادامه لطفاً کمی بیشتر توضیح بده.";
            emit({ type: "delta", text });
          } else if (outcome.kind === "answer" && outcome.answer) {
            text = outcome.answer;
            emit({ type: "delta", text });
          } else if (outcome.evidence.length === 0) {
            text = "برای این پرسش منبع معتبری در مستندات لیارا پیدا نکردم و نمی‌خواهم حدس بزنم. لطفاً نام سرویس یا متن دقیق خطا را بفرست.";
            emit({ type: "delta", text });
          } else {
            emit({ type: "status", message: "در حال آماده‌کردن پاسخ مستند…" });
            const grounded = buildGroundedPrompt(
              userMessage.content,
              outcome.evidence,
              answerDepth,
            );
            const messagesForGen: ChatCompletionMessageParam[] = [
              ...(customPrompt
                ? [{ role: "system" as const, content: customPrompt }]
                : []),
              grounded,
            ];
            const result = await withFallback((modelId) =>
              tryStream(modelId, messagesForGen),
            );
            const stream = result.value;
            modelUsed = result.model;
            if (!stream) throw new Error("همهٔ مدل‌های هوش مصنوعی در دسترس نیستند.");

            metadata.model = modelUsed;
            for await (const chunk of stream) {
              const token = chunk.choices[0]?.delta?.content;
              if (token) {
                text += token;
                emit({ type: "delta", text: token });
              }
            }
          }

          await saveMessage({
            threadId,
            role: "assistant",
            content: text,
            metadata,
          });
          await touchThread(threadId);

          logEvent("chat.completed", {
            model: modelUsed || "agent",
            kind: outcome.kind,
            ansChars: text.length,
            tookMs: Date.now() - startTime,
          });
          emit({ type: "done", metadata });
        } catch (err) {
          const message =
            err instanceof Error && err.message
              ? err.message
              : "پاسخ کامل نشد. دوباره تلاش کن.";
          logEvent("chat.stream_error", { message });
          emit({ type: "error", message, retryable: true });
        } finally {
          controller.close();
        }
      },
      cancel() {
        logEvent("chat.cancelled", { tookMs: Date.now() - startTime });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    logEvent("chat.failed", {
      message: err instanceof Error ? err.message : "unknown",
      tookMs: Date.now() - startTime,
    });
    return new Response("خطای غیرمنتظره‌ای رخ داد.", { status: 500 });
  }
}
