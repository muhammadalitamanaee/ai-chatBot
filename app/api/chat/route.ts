export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { getClientForModel, PROVIDERS, type ProviderName } from '@/lib/providers';
import { saveMessage, touchThread, renameThread, getMessagesByThread, getUserSettings } from '@/db/queries';
import type { ChatRequest } from '@/types/index';
import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

async function tryWithModel(
  modelId: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
): Promise<Stream<ChatCompletionChunk>> {
  const { client, model } = getClientForModel(modelId);

  const completionPromise = client.chat.completions.create({
    model,
    messages,
    max_tokens: 1024,
    stream: true as const,
  });

  const completion = await Promise.race([
    completionPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Model ${modelId} timed out`)), 15000)
    ),
  ]);

  return completion as Stream<ChatCompletionChunk>;
}

async function tryFallback(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
): Promise<Stream<ChatCompletionChunk>> {
  // Fallback chain when user's selected model fails
  const fallbackChain: ProviderName[] = ['openrouter', 'gapgpt'];

  for (const providerName of fallbackChain) {
    try {
      const provider = PROVIDERS[providerName];
      const client = provider.client();

      const completion = await Promise.race([
        client.chat.completions.create({
          model: provider.model,
          messages,
          max_tokens: 1024,
          stream: true as const,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fallback timed out')), 15000)
        ),
      ]);

      return completion as Stream<ChatCompletionChunk>;
    } catch {
      continue;
    }
  }

  throw new Error('All providers failed');
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body: ChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response('Messages are required', { status: 400 });
    }

    const { messages: chatMessages, threadId } = body;
    const userMessage = chatMessages[chatMessages.length - 1];

    // Load user's settings to get their model + system prompt
    const userSettings = await getUserSettings(session.user.id);
    const selectedModel = userSettings?.model ?? 'openai/gpt-oss-20b:free';
    const systemPrompt = userSettings?.systemPrompt;

    // Save user message
    await saveMessage({
      threadId,
      role: 'user',
      content: userMessage.content,
    });

    // Auto-title on first message
    const existingMessages = await getMessagesByThread(threadId, session.user.id);
    const isFirstMessage = existingMessages.length === 1;
    if (isFirstMessage) {
      const title = userMessage.content.length > 40
        ? userMessage.content.slice(0, 40).trimEnd() + '...'
        : userMessage.content;
      await renameThread(threadId, title, session.user.id);
    }

    // Build messages array — prepend system prompt if set
    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      // Only add system message if user has set one
      ...(systemPrompt?.trim()
        ? [{ role: 'system' as const, content: systemPrompt }]
        : []
      ),
      ...chatMessages.map(({ role, content }) => ({
        role: role as 'user' | 'assistant' | 'system',
        content,
      })),
    ];

    let completion: Stream<ChatCompletionChunk>;

    try {
      // Try user's selected model first
      completion = await tryWithModel(selectedModel, messages);
    } catch {
      console.log(`[/api/chat] Selected model ${selectedModel} failed, trying fallback`);
      try {
        // Fall back to default chain
        completion = await tryFallback(messages);
      } catch {
        return new Response('All AI providers are currently unavailable.', {
          status: 503,
        });
      }
    }

    let fullResponse = '';

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
            role: 'assistant',
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
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
        'X-Model-Used': selectedModel,
      },
    });

  } catch (err) {
    console.error('[/api/chat] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(message, { status: 500 });
  }
}