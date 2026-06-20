import OpenAI from "openai";

export function getOpenRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

export function getGapGPTClient() {
  return new OpenAI({
    apiKey: process.env.GAPGPT_API_KEY!,
    baseURL: "https://api.gapgpt.app/v1",
  });
}

export const MODELS = [
  {
    group: "OpenRouter — Free",
    models: [
      {
        id: "mistralai/mistral-7b-instruct:free",
        label: "Mistral 7B",
        description: "Lightweight and quick",
      },
      {
        id: "google/gemma-3-27b-it:free",
        label: "Gemma 3 27B",
        description: "Google's open model",
      },
      {
        id: "deepseek/deepseek-r1:free",
        label: "DeepSeek R1",
        description: "Strong reasoning model",
      },
      {
        id: "qwen/qwen3-14b:free",
        label: "Qwen 3 14B",
        description: "Alibaba multilingual model — good for Persian",
      },
      {
        id: "openai/gpt-oss-20b:free",
        label: "GPT OSS 20B",
        description: "Reliable fallback — recommended",
      },
    ],
  },
  {
    group: "GapGPT",
    models: [
      {
        id: "gapgpt-qwen-3.5",
        label: "GapGPT Qwen 3.5",
        description: "Iranian hosted, works locally",
      },
    ],
  },
] as const;

export const ALL_MODEL_IDS = MODELS.flatMap((g) => g.models.map((m) => m.id));

export function getClientForModel(modelId: string) {
  if (modelId.startsWith("gapgpt")) {
    return { client: getGapGPTClient(), model: modelId };
  }
  return { client: getOpenRouterClient(), model: modelId };
}

// Fallback chain — used when user's selected model fails
// Order matters: first one tried first
export const PROVIDERS = {
  openrouter: {
    client: getOpenRouterClient,
    model: "openai/gpt-oss-20b:free", // ← your go-to, first fallback
  },
  gapgpt: {
    client: getGapGPTClient,
    model: "gapgpt-qwen-3.5", // ← second fallback
  },
} as const;

export type ProviderName = keyof typeof PROVIDERS;
