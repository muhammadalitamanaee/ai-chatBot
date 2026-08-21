import { runAgent } from "../src/lib/agent";

async function main() {
  const q = "چطور یک اپ Next.js رو روی لیارا دیپلوی کنم؟";
  const outcome = await runAgent({
    question: q,
    history: [],
    answerDepth: "beginner",
  });
  console.log("kind:", outcome.kind);
  console.log("usesTools:", outcome.usesTools);
  console.log("steps:", outcome.steps);
  console.log("evidence:", outcome.evidence.map((e) => `${e.path} (${e.title})`));
  if (outcome.answer) console.log("answer:\n", outcome.answer.slice(0, 900));
  if (outcome.question) console.log("question:", outcome.question);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e); process.exit(1); });
