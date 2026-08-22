export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import {
  saveMessage,
  touchThread,
  renameThread,
  getMessagesByThread,
  getUserSettings,
} from '@/db/queries';
import type { ChatRequest } from '@/types/index';
import {
  runAgent,
  buildGroundedPrompt,
  type AnswerDepth,
} from '@/lib/agent';
import { tryStream, withFallback } from '@/lib/llm';
import { checkRateLimit } from '@/lib/rateLimit';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Neon-backed per-user rate limit — before any embedding/LLM cost.
    const rl = await checkRateLimit(session.user.id);
    if (!rl.allowed) {
      return new Response(
        `بیش از حد مجاز درخواست دادی. بعد از ${rl.retryAfterSec} ثانیه دوباره تلاش کن.`,
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        },
      );
    }

    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response('Messages are required', { status: 400 });
    }

    const { messages: chatMessages, threadId } = body;
    const userMessage = chatMessages[chatMessages.length - 1];

    const userSettings = await getUserSettings(session.user.id);
    const answerDepth: AnswerDepth =
      userSettings?.answerDepth === "professional" ? "professional" : "beginner";

    // Preserve the user's optional custom system prompt, but the copilot
    // grounding lives in the agent system prompt.
    const customPrompt = userSettings?.systemPrompt?.trim();

    // Save user message
    await saveMessage({ threadId, role: 'user', content: userMessage.content });

    // Auto-title on first message
    const existingMessages = await getMessagesByThread(threadId, session.user.id);
    const isFirstMessage = existingMessages.length === 1;
    if (isFirstMessage) {
      const title = userMessage.content.length > 40
        ? userMessage.content.slice(0, 40).trimEnd() + '...'
        : userMessage.content;
      await renameThread(threadId, title, session.user.id);
    }

    // Build history for the agent, dropping the system role it may carry.
    const history: ChatCompletionMessageParam[] = chatMessages
      .slice(0, -1)
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // 1) Agentic loop (intent + tools → evidence / clarifying question)
    const outcome = await runAgent({
      question: userMessage.content,
      history,
      answerDepth,
    });

    // Decide what text to stream.
    let text: string;
    let modelUsed = '';
    let realStream: Awaited<ReturnType<typeof tryStream>> | null = null;

    if (outcome.kind === 'ask') {
      text = outcome.question ?? 'برای ادامه لطفاً توضیح بیشتری بده.';
    } else if (outcome.kind === 'answer' && outcome.answer) {
      text = outcome.answer;
    } else {
      // kind === 'rag' → stream a freshly grounded answer from evidence.
      const grounded: ChatCompletionMessageParam = buildGroundedPrompt(
        userMessage.content,
        outcome.evidence,
        answerDepth,
      );
      const messagesForGen: ChatCompletionMessageParam[] = [
        { role: 'system', content: customPrompt ? `${customPrompt}\n\n` : '' },
        grounded,
      ].filter((m) => m.content !== '') as ChatCompletionMessageParam[];

      const res = await withFallback((modelId) => tryStream(modelId, messagesForGen));
      realStream = res.value;
      modelUsed = res.model;

      if (!realStream) {
        return new Response('همهٔ مدل‌های هوش مصنوعی در دسترس نیستند.', {
          status: 503,
        });
      }
    }

    const sources = outcome.evidence.map((e) => ({
      title: e.title,
      url: e.sourceUrl,
    }));
    const steps = outcome.steps;
    const agentic = outcome.usesTools || outcome.kind === 'ask';

    const encoder = new TextEncoder();

    // 2) Either stream the already-produced text, or real-time from a model.
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (realStream) {
            let full = '';
            for await (const chunk of realStream) {
              const token = chunk.choices[0]?.delta?.content;
              if (token) {
                full += token;
                controller.enqueue(encoder.encode(token));
              }
            }
            text = full;
          } else {
            controller.enqueue(encoder.encode(text));
          }

          await saveMessage({
            threadId,
            role: 'assistant',
            content: text,
            metadata: {
              sources,
              steps,
              ...(modelUsed ? { model: modelUsed } : {}),
              agentic,
            },
          });

          await touchThread(threadId);
        } catch (err) {
          console.error('[api/chat] stream error:', err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
        'X-Model-Used': modelUsed || 'agent',
      },
    });
  } catch (err) {
    console.error('[/api/chat] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(message, { status: 500 });
  }
}
