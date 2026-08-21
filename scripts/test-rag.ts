import { hybridSearch } from "../src/lib/rag";

async function main() {
  const queries = [
    "چطور یک اپ Next.js رو روی لیارا دیپلوی کنم؟",
    "POST /v1/databases",
    "خطای DNS برای دامنه",
  ];
  for (const q of queries) {
    console.log("\n=== QUERY:", q);
    const { results, usedVector } = await hybridSearch(q, { topK: 3 });
    console.log("usedVector:", usedVector, "| results:", results.length);
    for (const r of results) {
      console.log(
        `  [${r.service}] ${r.path} (idx ${r.chunkIndex}) ` +
        `vec=${r.vectorScore?.toFixed(3) ?? "-"} kw=${r.keywordScore?.toFixed(3) ?? "-"} rrf=${r.rrfScore.toFixed(3)}` +
        (r.endpoint ? ` | ${r.method} ${r.endpoint}` : ""),
      );
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e); process.exit(1); });
