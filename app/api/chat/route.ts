// This tells Next.js to run this route on the Node.js runtime
// (not the Edge runtime) — required because the Groq SDK uses
// Node.js built-ins that aren't available on the Edge
export const runtime = "nodejs";

// Vercel will kill serverless functions after 10s by default
// Streaming responses take longer, so we extend it to 30s
export const maxDuration = 30;

// NextRequest is Next.js's wrapper around the standard Request object
// It gives us helpers like req.json() with proper TypeScript types
import { NextRequest } from "next/server";

// The Groq SDK — works almost identically to the OpenAI SDK
// because Groq's API is OpenAI-compatible by design
import Groq from "groq-sdk";

// Import our Message type so TypeScript knows the shape of incoming data
import type { ChatRequest } from "@/types/index";

// Create the Groq client once, outside the function
// This is the singleton pattern — if it was inside the function,
// a new client would be created on every single request (wasteful)
const groq = new Groq({
  // process.env reads from your .env.local file locally
  // and from Vercel's environment variables in production
  // The ! tells TypeScript "trust me, this value exists"
  apiKey: process.env.GROQ_API_KEY!,
});

// Next.js App Router uses named exports for HTTP methods
// This function runs every time a POST request hits /api/chat
export async function POST(req: NextRequest) {
  try {
    // Parse the JSON body from the incoming request
    // This is what useChat.ts sends: { messages: [...] }
    const body: ChatRequest = await req.json();

    // Guard clause — if messages is missing or empty, reject early
    // Never let bad data reach the AI API (it costs money and time)
    if (!body.messages || body.messages.length === 0) {
      // 400 = Bad Request — the client sent something wrong
      return new Response("Messages are required", { status: 400 });
    }

    // Call Groq's API to create a streaming chat completion
    // stream: true is what makes it stream token by token
    // instead of waiting for the full response
    const completion = await groq.chat.completions.create({
      // llama-3.3-70b-versatile is Groq's best free model —
      // 70 billion parameters, fast, smart enough for most tasks
      model: "llama-3.3-70b-versatile",

      // Pass the full conversation history so the AI has context
      // The AI needs to see all previous messages to give coherent replies
      messages: body.messages,

      // Maximum number of tokens the AI can respond with
      // 1 token ≈ 0.75 words, so 1024 tokens ≈ ~750 words
      max_tokens: 1024,

      // Enable streaming — without this, Groq waits until the
      // full response is ready before sending anything back
      stream: true,
    });

    // ReadableStream is the Web Streams API — a standard way to
    // send data in chunks over HTTP. The browser reads it piece
    // by piece as chunks arrive, instead of waiting for all of it
      const readable = new ReadableStream({
        // start() is called immediately when the stream is created
        // controller is the object we use to push data into the stream
        async start(controller) {
          // TextEncoder converts a JavaScript string into bytes (Uint8Array)
          // HTTP streams send raw bytes, not strings, so this is required
          const encoder = new TextEncoder();

          try {
            // for await loops over async iterables — completion is one
            // Each iteration gives us one "chunk" from Groq
            // A chunk arrives every time Groq has generated a new token
            for await (const chunk of completion) {
              // Each chunk has a choices array (we only use index 0
              // because we're not doing multiple completions at once)
              // delta.content is the new text token in this chunk
              // It could be a word, part of a word, punctuation, or a space
              const token = chunk.choices[0]?.delta?.content;

              // token could be undefined if this is the final chunk
              // (the last chunk signals "done" but has no content)
              // So we only enqueue if there's actually something to send
              if (token) {
                // Encode the string token into bytes and push it
                // into the stream — the browser receives this immediately
                controller.enqueue(encoder.encode(token));
              }
            }
          } catch (err) {
            // If Groq throws mid-stream (e.g. network error),
            // signal the error to the stream so the client knows
            // something went wrong rather than hanging forever
            controller.error(err);
          } finally {
            // Always close the stream when done — whether we finished
            // normally or caught an error above. Without this, the
            // browser would wait forever for more data
            controller.close();
          }
        },
      });

    // Return the ReadableStream as the HTTP response body
    // The browser receives this and useChat.ts reads it chunk by chunk
    return new Response(readable, {
      headers: {
        // Tell the browser this is plain text coming in chunks
        // not a file download or JSON — just a raw text stream
        "Content-Type": "text/plain; charset=utf-8",

        // Disable Nginx/proxy buffering — without this, some hosting
        // providers collect all chunks and send them at once at the end,
        // which defeats the entire point of streaming
        "X-Accel-Buffering": "no",

        // Tell the browser and any CDN in between not to cache this
        // response — every request must reach the server fresh
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    // This outer catch handles errors before streaming starts —
    // e.g. Groq rejects the request, JSON parsing fails,
    // or the API key is invalid
    console.error("[/api/chat] Error:", err);

    // 500 = Internal Server Error — something went wrong on our side
    // We don't expose the actual error to the client for security
    return new Response("Internal server error", { status: 500 });
  }
}
