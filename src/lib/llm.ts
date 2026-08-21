import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

// ---------------------------------------------------------
// Aval AI is OpenAI-compatible. Only approved models are used
// (specs/05-llm-decisions.md). Generation fallback chain:
//   deepseek-v4-flash → qwen3.7-plus → glm-5.2
// Legacy OpenRouter/GapGPT keys are no longer in this chain.
// ---------------------------------------------------------
export const AVAL_BASE_URL = "https://api.avalai.ir/v1";
export const AVAL_CHAT_MODELS = [
  "deepseek-v4-flash",
  "qwen3.7-plus",
  "glm-5.2",
] as const;

export function avalClient() {
  return new OpenAI({
    apiKey: process.env.AVALAI_API_KEY!,
    baseURL: AVAL_BASE_URL,
  });
}

const REQUEST_TIMEOUT_MS = 25_000;

export interface CompletionOptions {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  maxTokens?: number;
  json?: boolean;
}

// ---------------------------------------------------------
// Non-streaming completion (used by the agent loop for tool-calling).
// Returns a full ChatCompletion or throws (caller rolls fallback).
// ---------------------------------------------------------
export async function chatCompletion(
  modelId: string,
  options: CompletionOptions,
): Promise<ChatCompletion> {
  const client = avalClient();
  return await client.chat.completions.create(
    {
      model: modelId,
      messages: options.messages,
      ...(options.tools?.length ? { tools: options.tools } : {}),
      max_tokens: options.maxTokens ?? 900,
      ...(options.json
        ? { response_format: { type: "json_object" as const } }
        : {}),
    },
    { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
  );
}

export type AvailStream = Stream<ChatCompletionChunk>;

// ---------------------------------------------------------
// Streaming completion (used for the final grounded answer).
// Returns null on failure so the caller can try the next model
// before any tokens are delivered (never splice two models).
// ---------------------------------------------------------
export async function tryStream(
  modelId: string,
  messages: ChatCompletionMessageParam[],
  opts: { maxTokens?: number } = {},
): Promise<AvailStream> {
  const client = avalClient();
  return await client.chat.completions.create(
    {
      model: modelId,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true as const,
    },
    { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
  );
}

// ---------------------------------------------------------
// Try the fallback chain for a provider function; returns the first
// successful result (a non-null value is considered success).
// ---------------------------------------------------------
export async function withFallback<T>(
  fn: (modelId: string) => Promise<T | null>,
): Promise<{ value: T | null; model: string }> {
  for (const model of AVAL_CHAT_MODELS) {
    try {
      const value = await fn(model);
      if (value !== null && value !== undefined) {
        return { value, model };
      }
    } catch (err) {
      console.warn(`[llm] Model ${model} failed, trying next.`, err);
    }
  }
  return { value: null, model: "" };
}
