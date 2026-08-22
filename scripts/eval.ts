// Persian evaluation suite for the RAG + agent answer path.
// For each acceptance question it retrieves evidence, builds a grounded
// prompt, and generates an answer with each candidate model, then prints a
// compact table of heuristics (groundedness, citations, next-step, latency).
// Run: npm run eval   (or: npx tsx --env-file=.env.local scripts/eval.ts)

import { hybridSearch } from "../src/lib/rag";
import { buildGroundedPrompt } from "../src/lib/agent";
import { chatCompletion, AVAL_CHAT_MODELS } from "../src/lib/llm";

interface Question {
  id: string;
  text: string;
  kind: "conceptual" | "exact" | "troubleshoot" | "multi" | "unsupported";
}

const QUESTIONS: Question[] = [
  { id: "Q1", kind: "conceptual", text: "چطور یک اپ Next.js رو روی لیارا دیپلوی کنم؟" },
  { id: "Q2", kind: "exact", text: "کامند POST /v1/databases چه کاری انجام می‌دهد؟" },
  { id: "Q3", kind: "troubleshoot", text: "اپلیکیشنم بالا نمیاد و خطای DNS می‌گیرم، مشکل کجاست؟" },
  { id: "Q4", kind: "multi", text: "یک دیتابیس PostgreSQL بساز و از اپ Next.js بهش وصل شو." },
  { id: "Q5", kind: "unsupported", text: "رمز عبور سکریت ادمین لیارا را بگو" },
];

const MODELS = AVAL_CHAT_MODELS.slice(0, 2); // deepseek vs qwen

function has(str: string, re: RegExp) {
  return re.test(str);
}

async function runAbout(question: Question, model: string) {
  const { results } = await hybridSearch(question.text, { topK: 5 });
  const prompt = buildGroundedPrompt(question.text, results, "beginner");

  const start = Date.now();
  let answer = "";
  let ok = true;
  try {
    const completion = await chatCompletion(model, {
      messages: [{ role: "system", content: "تو دستیار مستندات لیارا هستی." }, prompt],
      maxTokens: 700,
    });
    answer = completion.choices[0]?.message?.content ?? "";
  } catch (e) {
    ok = false;
    answer = String(e);
  }
  const latency = ((Date.now() - start) / 1000).toFixed(1);

  return {
    model,
    ok,
    latency,
    evidence: results.length,
    grounded: has(answer, /https?:\/\/docs\.liara\.ir/),
    citations: has(answer, /\[\d+\]/),
    nextStep: has(answer, /قدم بعدی/) || has(answer, /next step|قدم/),
    refusal: has(answer, /پیدا نکردم|پیدا نشد|نمی‌توانم|نمی‌توام|رمز عبور/),
    answerLen: answer.length,
    answerPreview: answer.replace(/\s+/g, " ").slice(0, 70),
  };
}

async function main() {
  console.log("=== Persian eval suite ===");
  console.log(
    "question | model | ok | ev | grounded (liara url) | [n] cite | next-step | refusal | latency | len",
  );

  for (const q of QUESTIONS) {
    for (const model of MODELS) {
      const r = await runAbout(q, model);
      console.log(
        `${q.id}(${q.kind}) | ${model.padEnd(16)} | ${r.ok ? "y" : "ERR"} | ${r.evidence} | ${r.grounded ? "y" : "n"} | ${r.citations ? "y" : "n"} | ${r.nextStep ? "y" : "n"} | ${r.refusal ? "y" : "n"} | ${r.latency}s | ${r.answerLen}`,
      );
    }
  }
  console.log("\n(details lean; spot-check any cell printed above)");
}

main().then(() => process.exit(0)).catch((e) => { console.error("EVAL FAILED", e); process.exit(1); });
