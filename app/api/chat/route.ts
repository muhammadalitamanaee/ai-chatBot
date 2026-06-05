export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { PROVIDERS, type ProviderName } from "@/lib/providers";
import { saveMessage, touchThread } from "@/db/queries";
import type { ChatRequest } from "@/types/index";

async function tryProvider(
  providerName: ProviderName,
  messages: { role: "user" | "assistant" | "system"; content: string }[],
): Promise<ReadableStream> {
  const provider = PROVIDERS[providerName];
  const client = provider.client();

  console.log(`[/api/chat] Trying provider: ${providerName}`);

  const completionPromise = client.chat.completions.create({
    model: provider.model,
    messages,
    max_tokens: 1024,
    stream: true,
  });

  const completion = (await Promise.race([
    completionPromise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider ${providerName} timed out`)),
        15000,
      ),
    ),
  ])) as Awaited<typeof completionPromise>;

  return completion;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    const { messages: chatMessages, threadId } = body;

    // The last message is always the user's new message
    const userMessage = chatMessages[chatMessages.length - 1];

    // Save user message immediately before streaming starts
    await saveMessage({
      threadId,
      role: "user",
      content: userMessage.content,
    });

    const messages = chatMessages.map(({ role, content }) => ({
      role: role as "user" | "assistant" | "system",
      content,
    }));

    const providerChain: ProviderName[] = ["openrouter", "gapgpt"];
    let lastError: Error | null = null;
    let usedProvider: ProviderName | null = null;

    for (const providerName of providerChain) {
      try {
        const completion = await tryProvider(providerName, messages);
        usedProvider = providerName;

        // Accumulate full response so we can save it after streaming
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

              // Stream finished — save the complete assistant message
              await saveMessage({
                threadId,
                role: "assistant",
                content: fullResponse,
              });

              // Update thread's updatedAt so it sorts correctly in sidebar
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
            "X-Provider-Used": usedProvider,
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
