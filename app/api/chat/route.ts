export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import gapgpt from "@/lib/gapgpt";
import type { ChatRequest } from "@/types/index";

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response("Messages are required", { status: 400 });
    }

    // Exact same pattern as OpenAI — because GapGPT is OpenAI-compatible
    // Just swap the model name to whatever GapGPT supports
    const completion = await gapgpt.chat.completions.create({
      model: "gapgpt-qwen-3.5",
      messages: body.messages,
      max_tokens: 1024,
      stream: true,
    });

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

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}
