import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract as tarExtract } from "tar";
import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  type Dirent,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { embedTexts, EMBEDDING_MODEL } from "./embeddings";
import { normalizePersian } from "./persian";
export { normalizePersian };
import { db } from "../db";
import { docChunks } from "../db/schema";
import { inArray, sql } from "drizzle-orm";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------
// Content hash for incremental ingestion
// ---------------------------------------------------------
export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

// ---------------------------------------------------------
// Service extraction from path
// paas/nextjs/getting-started → paas
// ---------------------------------------------------------
function extractService(path: string): string {
  const parts = path.split("/");
  return parts[0] || "unknown";
}

// ---------------------------------------------------------
// API metadata extraction (method + endpoint)
// Matches patterns like "POST /v1/databases" or "### POST /v1/databases"
// ---------------------------------------------------------
function extractApiMetadata(text: string): { method?: string; endpoint?: string } {
  const match = text.match(
    /(?:^|\n)\s*(?:###?\s+)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[\w{}\/.-]+)/i,
  );
  if (match) {
    return { method: match[1].toUpperCase(), endpoint: match[2] };
  }
  return {};
}

// ---------------------------------------------------------
// Parsed document shape
// ---------------------------------------------------------
export interface ParsedDoc {
  path: string;
  service: string;
  title: string;
  sourceUrl: string;
  headings: string[];
  originalText: string;
  searchText: string;
  apiMetadata?: { method?: string; endpoint?: string };
}

// ---------------------------------------------------------
// Parse a single markdown file
// Returns null for empty or nav-only pages
// ---------------------------------------------------------
export function parseMarkdown(
  filePath: string,
  content: string,
  basePath: string,
): ParsedDoc | null {
  const relativePath = relative(basePath, filePath)
    .split(sep)
    .join("/")
    .replace(/\.md$/, "");

  if (!content.trim()) return null;

  // Extract Original link header
  const originalLinkMatch = content.match(/^Original link:\s*(.+)$/m);
  const sourceUrl =
    originalLinkMatch?.[1]?.trim() ?? `https://docs.liara.ir/${relativePath}/`;

  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title =
    titleMatch?.[1]?.trim() ?? relativePath.split("/").pop() ?? "Untitled";

  // Extract all headings for breadcrumb context
  const headings = Array.from(content.matchAll(/^#{1,3}\s+(.+)$/gm)).map((m) =>
    m[1].trim(),
  );

  // Extract API metadata
  const apiMetadata = extractApiMetadata(content);

  // Strip the "Original link:" header for chunking
  const body = content.replace(/^Original link:\s*.+\n\n?/, "");

  // Skip nav-only pages (mostly links, very little prose)
  const linkCount = (body.match(/\[.*?\]\(.*?\)/g) || []).length;
  const proseLength = body
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/[#*`_~>|-]/g, "")
    .trim().length;
  if (proseLength < 80 && linkCount > proseLength / 5) return null;

  return {
    path: relativePath,
    service: extractService(relativePath),
    title,
    sourceUrl,
    headings,
    originalText: body,
    searchText: normalizePersian(body),
    ...(Object.keys(apiMetadata).length > 0 ? { apiMetadata } : {}),
  };
}

// ---------------------------------------------------------
// Fetch the docs repo tarball and extract public/llms/
// Returns the path to the extracted llms directory
// ---------------------------------------------------------
export async function fetchDocs(destDir: string): Promise<string> {
  const tarballUrl =
    "https://github.com/liara-cloud/docs/archive/refs/heads/master.tar.gz";
  const extractDir = join(destDir, "liara-docs-extract");

  mkdirSync(extractDir, { recursive: true });

  console.log(`[ingest] Fetching tarball from ${tarballUrl}`);
  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch tarball: ${response.status} ${response.statusText}`);
  }
  if (!response.body) throw new Error("No response body");

  console.log("[ingest] Extracting public/llms/...");
  await pipeline(
    Readable.fromWeb(response.body as unknown as WebReadableStream),
    createGunzip(),
    tarExtract({
      cwd: extractDir,
      filter: (path) => path.includes("public/llms/"),
    }),
  );

  // Find the extracted repo directory (e.g., docs-master/)
  const dirs = readdirSync(extractDir);
  if (dirs.length === 0) throw new Error("Tarball extraction produced no directories");
  const repoDir = join(extractDir, dirs[0]);
  const llmsDir = join(repoDir, "public", "llms");

  if (!existsSync(llmsDir)) {
    throw new Error(`public/llms/ not found in extracted tarball at ${llmsDir}`);
  }

  console.log(`[ingest] Extracted llms dir: ${llmsDir}`);
  return llmsDir;
}

// ---------------------------------------------------------
// Collect all .md files from a directory tree
// ---------------------------------------------------------
export function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".md")) files.push(full);
    }
  }

  return files;
}

// ---------------------------------------------------------
// Read and parse all markdown files from the llms directory
// Returns array of parsed docs (skipping nulls)
// ---------------------------------------------------------
export function parseAllDocs(llmsDir: string): ParsedDoc[] {
  const files = collectMarkdownFiles(llmsDir);
  console.log(`[ingest] Found ${files.length} markdown files`);

  const docs: ParsedDoc[] = [];
  let skipped = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const parsed = parseMarkdown(file, content, llmsDir);
    if (parsed) {
      docs.push(parsed);
    } else {
      skipped++;
    }
  }

  console.log(`[ingest] Parsed ${docs.length} docs, skipped ${skipped}`);
  return docs;
}

// ---------------------------------------------------------
// Chunk a parsed document
// Splits by headings, then size-splits (~800 tokens) with ~15% overlap.
// Preserves heading breadcrumb for context.
// ---------------------------------------------------------
export interface Chunk {
  path: string;
  service: string;
  title: string;
  sourceUrl: string;
  heading: string;
  chunkText: string;
  chunkIndex: number;
  contentHash: string;
  metadata?: {
    method?: string;
    endpoint?: string;
    headings?: string[];
  };
}

// Approximate token count: ~4 chars per token for mixed Persian/English
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkDoc(doc: ParsedDoc, maxTokens = 800, overlapRatio = 0.15): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Split by headings (h1, h2, h3)
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  const sections: { heading: string; content: string }[] = [];

  let lastHeading = doc.title;
  let lastIndex = 0;

  const matches = Array.from(doc.originalText.matchAll(headingRegex));

  for (const match of matches) {
    const matchStart = match.index ?? 0;
    const heading = match[1].trim();

    // Save previous section
    if (matchStart > lastIndex) {
      const content = doc.originalText.slice(lastIndex, matchStart).trim();
      if (content) {
        sections.push({ heading: lastHeading, content });
      }
    }

    lastHeading = heading;
    lastIndex = matchStart;
  }

  // Final section
  if (lastIndex < doc.originalText.length) {
    const content = doc.originalText.slice(lastIndex).trim();
    if (content) {
      sections.push({ heading: lastHeading, content });
    }
  }

  // If no headings found, treat entire doc as one section
  if (sections.length === 0) {
    sections.push({ heading: doc.title, content: doc.originalText });
  }

  // Process each section
  for (const section of sections) {
    const breadcrumb = `${doc.title} > ${section.heading}`;
    const sectionTokens = estimateTokens(section.content);

    // If section fits in maxTokens, keep it whole
    if (sectionTokens <= maxTokens) {
      const chunkText = `${breadcrumb}\n\n${section.content}`;
      chunks.push({
        path: doc.path,
        service: doc.service,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        heading: section.heading,
        chunkText,
        chunkIndex: chunkIndex++,
        contentHash: contentHash(chunkText),
        ...(doc.apiMetadata ? { metadata: { ...doc.apiMetadata, headings: [breadcrumb] } } : {}),
      });
    } else {
      // Size-split with overlap. Guarantees forward progress every
      // iteration — the naive "breakAt - overlap" step can regress or
      // stall when a paragraph/sentence break lands close to `start`,
      // which previously caused an unbounded loop (OOM on real docs).
      const overlapChars = Math.floor(maxTokens * overlapRatio * 4);
      const targetChars = (maxTokens - Math.floor(maxTokens * overlapRatio)) * 4;
      const minAdvance = Math.max(1, Math.floor(targetChars / 4)); // never advance less than this

      let start = 0;
      while (start < section.content.length) {
        const windowEnd = Math.min(start + targetChars, section.content.length);
        const chunkContent = section.content.slice(start, windowEnd);

        // Try to break at paragraph or sentence boundary within the window
        let breakAt = windowEnd;
        const lastParagraph = chunkContent.lastIndexOf("\n\n");
        const lastSentence = chunkContent.lastIndexOf(". ");
        const lastBreak = Math.max(lastParagraph, lastSentence);
        const minBreakOffset = Math.floor(targetChars / 2);

        if (lastBreak > minBreakOffset) {
          breakAt = start + lastBreak + 1;
        }

        const chunkText = `${breadcrumb}\n\n${section.content.slice(start, breakAt).trim()}`;
        chunks.push({
          path: doc.path,
          service: doc.service,
          title: doc.title,
          sourceUrl: doc.sourceUrl,
          heading: section.heading,
          chunkText,
          chunkIndex: chunkIndex++,
          contentHash: contentHash(chunkText),
          ...(doc.apiMetadata ? { metadata: { ...doc.apiMetadata, headings: [breadcrumb] } } : {}),
        });

        if (breakAt >= section.content.length) break;

        // Step forward by at least minAdvance, applying overlap only
        // when it doesn't cause the window to stall or regress.
        const overlapStart = breakAt - overlapChars;
        const nextStart = Math.max(overlapStart, start + minAdvance);
        start = nextStart;
      }
    }
  }

  return chunks;
}

// ---------------------------------------------------------
// Chunk all parsed docs
// ---------------------------------------------------------
export function chunkAllDocs(docs: ParsedDoc[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const doc of docs) {
    chunks.push(...chunkDoc(doc));
  }
  console.log(`[ingest] Generated ${chunks.length} chunks from ${docs.length} docs`);
  return chunks;
}

// ---------------------------------------------------------
// Fetch existing (path, chunk_index) -> content_hash for a batch,
// in a single query, so we can skip embedding unchanged chunks.
// ---------------------------------------------------------
async function fetchExistingHashes(chunks: Chunk[]): Promise<Map<string, string>> {
  const paths = [...new Set(chunks.map((c) => c.path))];
  const rows = await db
    .select({ path: docChunks.path, chunkIndex: docChunks.chunkIndex, contentHash: docChunks.contentHash })
    .from(docChunks)
    .where(inArray(docChunks.path, paths));

  const map = new Map<string, string>();
  for (const r of rows) map.set(`${r.path}|${r.chunkIndex}`, r.contentHash);
  return map;
}

// ---------------------------------------------------------
// Batch upsert using ON CONFLICT (path, chunk_index) DO UPDATE.
// Idempotent: unchanged rows skip, changed content is overwritten
// in place (no stale rows left behind when content_hash differs).
// ---------------------------------------------------------
async function upsertBatch(chunks: Chunk[], embeddings: number[][]) {
  if (chunks.length === 0) return;

  const values = chunks.map((c, i) => ({
    service: c.service,
    path: c.path,
    title: c.title,
    sourceUrl: c.sourceUrl,
    heading: c.heading ?? null,
    chunkText: c.chunkText,
    chunkIndex: c.chunkIndex,
    contentHash: c.contentHash,
    embeddingModel: EMBEDDING_MODEL,
    embedding: embeddings[i],
    metadata: c.metadata ?? null,
  }));

  await db.insert(docChunks).values(values).onConflictDoUpdate({
    target: [docChunks.path, docChunks.chunkIndex],
    set: {
      title: sql`excluded.title`,
      sourceUrl: sql`excluded.source_url`,
      heading: sql`excluded.heading`,
      chunkText: sql`excluded.chunk_text`,
      contentHash: sql`excluded.content_hash`,
      embeddingModel: sql`excluded.embedding_model`,
      embedding: sql`excluded.embedding`,
      metadata: sql`excluded.metadata`,
      indexedAt: sql`now()`,
    },
  });
}

// ---------------------------------------------------------
// Remove rows whose paths no longer exist upstream. Called only
// after a fully successful run so a failed run never wipes the index.
// ---------------------------------------------------------
async function removeStalePaths(keptPaths: Set<string>) {
  const rows = await db.select({ path: docChunks.path }).from(docChunks);
  const storedPaths = new Set(rows.map((r) => r.path));
  const stale = [...storedPaths].filter((p) => !keptPaths.has(p));
  if (stale.length === 0) return;
  await db.delete(docChunks).where(inArray(docChunks.path, stale));
  console.log(`[ingest] Removed ${stale.length} stale paths no longer present upstream`);
}

// ---------------------------------------------------------
// Full ingestion pipeline — batch-persistent and resumable.
//
// For each batch:
//   1. query existing (path, chunk_index) hashes (1 query)
//   2. embed only changed/new chunks (retry/backoff)
//   3. upsert the batch immediately (ON CONFLICT DO UPDATE)
// A failure mid-run keeps earlier batches; rerunning skips
// unchanged chunks via content hash.
// ---------------------------------------------------------
export async function ingest(destDir: string, batchSize = 100, rpmDelayMs = 20_000) {
  console.log("[ingest] Starting full ingestion pipeline...");

  // 1. Fetch and extract docs
  const llmsDir = await fetchDocs(destDir);

  // 2. Parse all markdown files
  const docs = parseAllDocs(llmsDir);

  // 3. Chunk documents
  const chunks = chunkAllDocs(docs);

  console.log(`[ingest] Processing ${chunks.length} chunks in batches of ${batchSize}`);

  let inserted = 0;
  let skipped = 0;
  const keptPaths = new Set<string>();

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Existing hashes for this batch (skip unchanged, avoid re-embedding)
    const existing = await fetchExistingHashes(batch);
    const changed = batch.filter(
      (c) => existing.get(`${c.path}|${c.chunkIndex}`) !== c.contentHash,
    );
    const unchangedCount = batch.length - changed.length;

    // Embed only changed chunks
    let embeddings: number[][] = [];
    if (changed.length > 0) {
      const texts = changed.map((c) => c.chunkText);
      embeddings = await embedTexts(texts);
      inserted += changed.length;
    }
    skipped += unchangedCount;

    // Persist this batch immediately
    await upsertBatch(changed, embeddings);

    for (const c of batch) keptPaths.add(c.path);

    const done = Math.min(i + batchSize, chunks.length);
    console.log(`[ingest] ${done}/${chunks.length} processed (inserted=${inserted}, unchanged=${skipped})`);

    // Rate limit: tier-0 embedding is ~3 rpm; one request per batch.
    if (i + batchSize < chunks.length) await sleep(rpmDelayMs);
  }

  // 5. Never delete stale paths unless the whole run succeeded.
  await removeStalePaths(keptPaths);

  console.log(`[ingest] Pipeline complete. inserted/updated=${inserted}, unchanged=${skipped}`);
}
