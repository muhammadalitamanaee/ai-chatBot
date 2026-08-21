import assert from "node:assert/strict";
import { computeBackoff } from "../src/lib/embeddings";
import {
  normalizePersian,
  parseMarkdown,
  chunkDoc,
  contentHash,
} from "../src/lib/ingest";
import type { ParsedDoc } from "../src/lib/ingest";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

console.log("ingest unit tests");

// ---------------------------------------------------------
// normalizePersian
// ---------------------------------------------------------
ok("normalizePersian maps Arabic to Persian + collapses whitespace", () => {
  assert.equal(normalizePersian("سلام چطوری"), "سلام چطوری");
  assert.equal(normalizePersian("ي و ك"), "ی و ک");
  assert.equal(normalizePersian("می‌روم"), "می روم"); // ZWNJ -> space
  assert.equal(normalizePersian("  a   b\t c  "), "a b c");
});

// ---------------------------------------------------------
// computeBackoff
// ---------------------------------------------------------
ok("computeBackoff respects Retry-After on 429", () => {
  const err = { status: 429, headers: { get: (k: string) => (k === "retry-after" ? "7" : null) } };
  assert.equal(computeBackoff(err, 1), 7000);
});

ok("computeBackoff falls back to exponential for 5xx", () => {
  const err = { status: 502, headers: { get: () => null } };
  assert.equal(computeBackoff(err, 1), 2000);
  assert.equal(computeBackoff(err, 2), 4000);
  assert.equal(computeBackoff(err, 3), 8000);
});

ok("computeBackoff caps at 60s", () => {
  const err = { status: 503, headers: { get: () => null } };
  assert.equal(computeBackoff(err, 10), 60000);
});

// ---------------------------------------------------------
// parseMarkdown — Windows relative paths
// ---------------------------------------------------------
const baseWin = "C:\\data\\liara-docs-extract\\docs-master\\public\\llms";
const fileWin = baseWin + "\\paas\\nextjs\\getting-started.md";

const sample = `# راهنمای استقرار Next.js
Original link: https://docs.liara.ir/paas/nextjs/getting-started/

این یک بند کامل درباره استقرار برنامه Next.js روی لیارا است.
مراحل زیر را دنبال کنید تا بتوانید برنامه خود را مستقر کنید.
از دستور liara deploy استفاده می کنید و بعد تنظیمات را انجام می دهید.
این متن برای اطمینان از اینکه چک ناوبری آن را نادیده نمی گیرد کافی است.`;

ok("parseMarkdown derives path from Windows backslash separators", () => {
  const doc = parseMarkdown(fileWin, sample, baseWin);
  assert.ok(doc, "expected a parsed doc");
  assert.equal(doc!.path, "paas/nextjs/getting-started");
  assert.equal(doc!.service, "paas");
  assert.equal(doc!.sourceUrl, "https://docs.liara.ir/paas/nextjs/getting-started/");
  assert.equal(doc!.title, "راهنمای استقرار Next.js");
});

ok("parseMarkdown handles forward-slash paths too", () => {
  const base = "data/llms";
  const doc = parseMarkdown(base + "/paas/nextjs/getting-started.md", sample, base);
  assert.ok(doc);
  assert.equal(doc!.path, "paas/nextjs/getting-started");
});

// ---------------------------------------------------------
// chunkDoc — forward-progress guarantee (no infinite loop / OOM)
// ---------------------------------------------------------
function makeLongDoc(paragraphs: number): ParsedDoc {
  const body: string[] = [];
  for (let i = 0; i < paragraphs; i++) {
    body.push(
      `بند شماره ${i} برای اطمینان از پیشرفت حلقه: متن کافی و پر از جمله های بلند ` +
      `که به پاراگراف بعدی می پیوندند و باعث می شوند بخش به چند تکه تقسیم شود. `.repeat(3) +
      `Finishing sentence number ${i}.`,
    );
  }
  return {
    path: "paas/nextjs/getting-started",
    service: "paas",
    title: "راهنمای استقرار Next.js",
    sourceUrl: "https://docs.liara.ir/paas/nextjs/getting-started/",
    headings: [],
    originalText: "# راهنمای استقرار Next.js\n\n" + body.join("\n\n"),
    searchText: "راهنمای استقرار Next.js",
  };
}

ok("chunkDoc terminates and emits sequential chunk indexes for oversized section", () => {
  const doc = makeLongDoc(200); // far beyond a single 800-token window
  const chunks = chunkDoc(doc, 80, 0.15); // small window forces many splits
  assert.ok(chunks.length > 1, `expected multiple chunks, got ${chunks.length}`);
  const indexes = chunks.map((c) => c.chunkIndex);
  const unique = new Set(indexes);
  assert.equal(unique.size, indexes.length, "chunk indexes must be unique");
  for (const c of chunks) {
    assert.ok(c.chunkText.length > 0, "chunk text must not be empty");
    assert.equal(c.path, doc.path);
  }
});

ok("contentHash is stable and differs for changed text", () => {
  assert.equal(contentHash("same"), contentHash("same"));
  assert.notEqual(contentHash("same"), contentHash("other"));
});

console.log(`\nAll ${passed} ingest tests passed.`);
