import OpenAI from "openai";

// OpenRouter — primary provider
// Works globally from any Vercel region, free models available
export function getOpenRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

// GapGPT — fallback provider
// Works best from Iran, used when OpenRouter fails
export function getGapGPTClient() {
  return new OpenAI({
    apiKey: process.env.GAPGPT_API_KEY!,
    baseURL: "https://api.gapgpt.app/v1",
  });
}

// The model each provider should use
export const PROVIDERS = {
  openrouter: {
    client: getOpenRouterClient,
    // Free model on OpenRouter — good quality, no cost
    model: "openai/gpt-oss-20b:free",
  },
  gapgpt: {
    client: getGapGPTClient,
    model: "gapgpt-qwen-3.5",
  },
} as const;

export type ProviderName = keyof typeof PROVIDERS;
