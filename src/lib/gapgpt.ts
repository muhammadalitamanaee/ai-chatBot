import OpenAI from "openai";

const gapgpt = new OpenAI({
  apiKey: process.env.GAPGPT_API_KEY!,
  // This is the only thing that makes it different from OpenAI —
  // we point the SDK to GapGPT's server instead of OpenAI's
  baseURL: "https://api.gapgpt.app/v1",
});

export default gapgpt;
