export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { PROVIDERS, type ProviderName } from "@/lib/providers";
import {
  saveMessage,
  touchThread,
  renameThread,
  getMessagesByThread,
} from "@/db/queries";
import type { ChatRequest } from "@/types/index";

import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

// Change the return type to explicitly be a Stream
async function tryProvider(
  providerName: ProviderName,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
): Promise<Stream<ChatCompletionChunk>> {
  const provider = PROVIDERS[providerName];
  const client = provider.client();

  console.log(`[/api/chat] Trying provider: ${providerName}`);

  // stream: true as const tells TypeScript this is ALWAYS a stream
  // not the union type it assumes by default
  const completionPromise = client.chat.completions.create({
    model: provider.model,
    messages,
    max_tokens: 1024,
    stream: true as const,
  });

  const completion = await Promise.race([
    completionPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider ${providerName} timed out`)),
        15000,
      ),
    ),
  ]);

  return completion as Stream<ChatCompletionChunk>;
}
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    const { messages: chatMessages, threadId } = body;
    const userMessage = chatMessages[chatMessages.length - 1];

    // Save user message immediately
    await saveMessage({
      threadId,
      role: "user",
      content: userMessage.content,
    });

    // Check if this is the first message in the thread
    // If so, we'll auto-title the thread after saving
    const existingMessages = await getMessagesByThread(
      threadId,
      session.user.id,
    );
    const isFirstMessage = existingMessages.length === 1; // only the one we just saved

    // Auto-title — trim first message to 40 chars
    if (isFirstMessage) {
      const title =
        userMessage.content.length > 40
          ? userMessage.content.slice(0, 40).trimEnd() + "..."
          : userMessage.content;
      await renameThread(threadId, title, session.user.id);
    }

    const messages = chatMessages.map(({ role, content }) => ({
      role: role as "user" | "assistant" | "system",
      content,
    }));

    const providerChain: ProviderName[] = ["openrouter", "gapgpt"];
    let lastError: Error | null = null;

    for (const providerName of providerChain) {
      try {
        const completion = await tryProvider(providerName, messages);
        let fullResponse = "";

        const readable = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of completion) {
                const token = chunk.choices[0]?.delta?.content;
                if (token) {
                  fullResponse += token;
                  controller.enqueue(encoder.encode(token));
                }
              }

              await saveMessage({
                threadId,
                role: "assistant",
                content: fullResponse,
              });

              await touchThread(threadId);
            } catch (err) {
              controller.error(err);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "X-Provider-Used": providerName,
          },
        });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");
        console.error(
          `[/api/chat] Provider ${providerName} failed:`,
          lastError.message,
        );
      }
    }

    return new Response("All AI providers are currently unavailable.", {
      status: 503,
    });
  } catch (err) {
    console.error("[/api/chat] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}
