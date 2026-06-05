export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { PROVIDERS, type ProviderName } from "@/lib/providers";
import type { ChatRequest } from "@/types/index";

// Tries one provider and returns a ReadableStream
// Throws if the provider fails — so we can catch and try the next one
async function tryProvider(
  providerName: ProviderName,
  messages: { role: string; content: string }[],
): Promise<ReadableStream> {
  const provider = PROVIDERS[providerName];
  const client = provider.client();

  console.log(`[/api/chat] Trying provider: ${providerName}`);

  // We wrap this in a promise with a timeout
  // If the provider doesn't respond in 15 seconds, we give up and try the next one
  const timeoutMs = 15000;

  const completionPromise = client.chat.completions.create({
    model: provider.model,
    messages,
    max_tokens: 1024,
    stream: true,
  });

  // Race the API call against a timeout
  // Whichever resolves/rejects first wins
  const completion = (await Promise.race([
    completionPromise,
    // After 15s this rejects, causing us to fall through to the next provider
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider ${providerName} timed out`)),
        timeoutMs,
      ),
    ),
  ])) as Awaited<typeof completionPromise>;

  // If we get here, the provider responded — build the stream
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            controller.enqueue(encoder.encode(token));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return readable;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    const messages = body.messages.map(({ role, content }) => ({
      role: role as "user" | "assistant" | "system",
      content,
    }));

    // The fallback chain — try providers in this order
    // If the first one fails, we catch the error and try the next
    const providerChain: ProviderName[] = ["openrouter", "gapgpt"];

    let lastError: Error | null = null;

    for (const providerName of providerChain) {
      try {
        // Try this provider — if it works, stream it back immediately
        const stream = await tryProvider(providerName, messages);

        console.log(`[/api/chat] Success with provider: ${providerName}`);

        // Return which provider was used as a header — useful for debugging
        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            // You can read this header in the browser devtools to see which provider responded
            "X-Provider-Used": providerName,
          },
        });
      } catch (err) {
        // This provider failed — log it and try the next one
        lastError = err instanceof Error ? err : new Error("Unknown error");
        console.error(
          `[/api/chat] Provider ${providerName} failed:`,
          lastError.message,
        );
        // Loop continues to next provider automatically
      }
    }

    // All providers failed
    console.error(
      "[/api/chat] All providers failed. Last error:",
      lastError?.message,
    );
    return new Response(
      "All AI providers are currently unavailable. Please try again.",
      {
        status: 503, // 503 = Service Unavailable (more accurate than 500 here)
      },
    );
  } catch (err) {
    console.error("[/api/chat] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}
