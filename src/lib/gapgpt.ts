import OpenAI from "openai";

// DON'T do this — runs at build time, key doesn't exist yet
// const gapgpt = new OpenAI({ ... })  ← this is what breaks it

// DO this instead — a function that creates the client on demand
// It only runs when a route handler actually calls it, not during build
export function getGapGPTClient() {
  return new OpenAI({
    apiKey: process.env.GAPGPT_API_KEY!,
    baseURL: "https://api.gapgpt.app/v1",
  });
}
