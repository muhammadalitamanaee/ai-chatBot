import { db } from "../db";
import { docChunks } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { embedQuery, toVectorLiteral } from "./embeddings";
import { normalizePersian } from "./persian";

// ---------------------------------------------------------
// Hybrid retrieval: pgvector semantic search + pg_trgm keyword
// search, fused with Reciprocal Rank Fusion (RRF). Semantic search
// alone fails on exact endpoints/error strings, so keyword search
// (language-agnostic trigrams) covers those. On embedding failure
// we degrade gracefully to keyword-only — never crash the request.
// ---------------------------------------------------------

export interface Evidence {
  path: string;
  service: string;
  title: string;
  sourceUrl: string;
  heading: string | null;
  chunkText: string;
  chunkIndex: number;
  /** semantic similarity (1 - cosine distance); only when vector used */
  vectorScore?: number;
  /** greatest trigram similarity across text/title/path */
  keywordScore?: number;
  /** RRF fused score (ordinal — NOT a probability) */
  rrfScore: number;
  method?: string;
  endpoint?: string;
}

export interface HybridResult {
  results: Evidence[];
  /** false when query embedding failed and we fell back to keyword-only */
  usedVector: boolean;
}

export function fallbackOf(e: Evidence): Pick<Evidence, "method" | "endpoint"> {
  return { method: e.method, endpoint: e.endpoint };
}

const RRF_K = 60;

// ---------------------------------------------------------
// Semantic search via pgvector cosine distance (<=>).
// Throws on embedding failure (caller handles keyword-only).
// ---------------------------------------------------------
async function vectorSearch(
  query: string,
  opts: { topK?: number; service?: string; minScore?: number } = {},
): Promise<{ item: Evidence; score: number }[]> {
  const { topK = 8, service, minScore = 0 } = opts;
  const vec = await embedQuery(normalizePersian(query));
  const lit = toVectorLiteral(vec);

  const baseWhere: (SQL | undefined)[] = [];
  if (service) baseWhere.push(eq(docChunks.service, service));

  const rows = await db
    .select({
      path: docChunks.path,
      service: docChunks.service,
      title: docChunks.title,
      sourceUrl: docChunks.sourceUrl,
      heading: docChunks.heading,
      chunkText: docChunks.chunkText,
      chunkIndex: docChunks.chunkIndex,
      metadata: docChunks.metadata,
      similarity: sql<number>`1 - (${lit}::vector <=> ${docChunks.embedding})`,
    })
    .from(docChunks)
    .where(and(...baseWhere))
    .orderBy(sql`${docChunks.embedding} <=> ${lit}::vector`)
    .limit(topK * 3);

  const results: { item: Evidence; score: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const score = r.similarity;
    if (minScore > 0 && score < minScore) continue;
    const meta = (r.metadata ?? {}) as { method?: string; endpoint?: string };
    results.push({
      item: {
        path: r.path,
        service: r.service,
        title: r.title,
        sourceUrl: r.sourceUrl,
        heading: r.heading,
        chunkText: r.chunkText,
        chunkIndex: r.chunkIndex,
        vectorScore: score,
        rrfScore: 0,
        ...(meta.method ? { method: meta.method } : {}),
        ...(meta.endpoint ? { endpoint: meta.endpoint } : {}),
      },
      score,
    });
  }

  return results.slice(0, topK);
}

// ---------------------------------------------------------
// Keyword search via pg_trgm similarity + ILIKE on text/title/path.
// Language-agnostic — catches exact endpoints ("POST /v1/databases")
// and error strings that pure embeddings miss.
// ---------------------------------------------------------
async function keywordSearch(
  query: string,
  opts: { topK?: number; service?: string } = {},
): Promise<{ item: Evidence; score: number }[]> {
  const { topK = 8, service } = opts;
  const q = normalizePersian(query);

  // Whole-phrase trigram similarity across text/title/path.
  const phraseSim = sql`GREATEST(
    similarity(${docChunks.chunkText}, ${q}),
    similarity(${docChunks.title}, ${q}),
    similarity(${docChunks.path}, ${q})
  )`;

  // Tokenize so exact-ish substrings (endpoints, error strings, IDs)
  // match even when the whole phrase never appears contiguously.
  const tokens = q.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
  const tokenSims: SQL[] = tokens.flatMap((t) => [
    sql`similarity(${docChunks.chunkText}, ${t})`,
    sql`similarity(${docChunks.title}, ${t})`,
    sql`similarity(${docChunks.path}, ${t})`,
  ]);

  const simExpr = sql<number>`GREATEST(${phraseSim}, ${sql.join(tokenSims, sql`, `)})`;

  // Match if the whole phrase trigram-matches, OR any token appears as a
  // substring (GIN/trigram friendly) — language-agnostic retrieval.
  const tokenMatch = tokens.map((t) =>
    sql`(
      ${docChunks.chunkText} ILIKE ${`%${t}%`} OR
      ${docChunks.title} ILIKE ${`%${t}%`} OR
      ${docChunks.path} ILIKE ${`%${t}%`}
    )`,
  );

  const baseWhere: (SQL | undefined)[] = [
    sql`(
      ${docChunks.chunkText} % ${q} OR
      ${docChunks.title} % ${q} OR
      ${docChunks.path} % ${q} OR
      ${sql.join(tokenMatch, sql` OR `)}
    )`,
  ];
  if (service) baseWhere.push(eq(docChunks.service, service));

  const rows = await db
    .select({
      path: docChunks.path,
      service: docChunks.service,
      title: docChunks.title,
      sourceUrl: docChunks.sourceUrl,
      heading: docChunks.heading,
      chunkText: docChunks.chunkText,
      chunkIndex: docChunks.chunkIndex,
      metadata: docChunks.metadata,
      keywordScore: simExpr,
    })
    .from(docChunks)
    .where(and(...baseWhere))
    .orderBy(sql`${simExpr} DESC`)
    .limit(topK * 3);

  const results: { item: Evidence; score: number }[] = [];
  for (const r of rows) {
    const score = r.keywordScore;
    if (score < 0.01) continue;
    const meta = (r.metadata ?? {}) as { method?: string; endpoint?: string };
    results.push({
      item: {
        path: r.path,
        service: r.service,
        title: r.title,
        sourceUrl: r.sourceUrl,
        heading: r.heading,
        chunkText: r.chunkText,
        chunkIndex: r.chunkIndex,
        keywordScore: score,
        rrfScore: 0,
        ...(meta.method ? { method: meta.method } : {}),
        ...(meta.endpoint ? { endpoint: meta.endpoint } : {}),
      },
      score,
    });
  }

  return results.slice(0, topK);
}

// ---------------------------------------------------------
// Reciprocal Rank Fusion across a list of ranked lists.
// returns Map key -> cumulative RRF score. RRF is ordinal; never
// treat it as a probability (confidence uses raw vector similarity).
// ---------------------------------------------------------
function rrfFuse(
  lists: { item: Evidence }[][],
  k: number = RRF_K,
): Map<string, { evidence: Evidence; rrf: number }> {
  const acc = new Map<string, { evidence: Evidence; rrf: number }>();
  for (const list of lists) {
    list.forEach((entry, idx) => {
      const key = `${entry.item.path}|${entry.item.chunkIndex}`;
      const contrib = 1 / (k + idx + 1);
      const existing = acc.get(key);
      if (existing) {
        existing.rrf += contrib;
      } else {
        acc.set(key, { evidence: entry.item, rrf: contrib });
      }
    });
  }
  return acc;
}

// ---------------------------------------------------------
// Hybrid search: vector + keyword, RRF fusion, top-k evidence.
// If query embedding is unavailable, fall back to keyword-only.
// ---------------------------------------------------------
export async function hybridSearch(
  query: string,
  opts: { topK?: number; service?: string; minScore?: number } = {},
): Promise<HybridResult> {
  const { topK = 5 } = opts;

  let vectorResults: { item: Evidence; score: number }[] = [];
  let usedVector = true;
  try {
    vectorResults = await vectorSearch(query, opts);
  } catch (err) {
    console.warn("[rag] Embedding failed; falling back to keyword-only.", err);
    usedVector = false;
  }

  const keywordResults = await keywordSearch(query, opts);

  const fused = rrfFuse([vectorResults, keywordResults]);

  const ranked = [...fused.entries()]
    .map(([key, { evidence, rrf }]) => {
      const vec = vectorResults.find((v) => `${v.item.path}|${v.item.chunkIndex}` === key);
      const kw = keywordResults.find((k) => `${k.item.path}|${k.item.chunkIndex}` === key);
      return { evidence, rrf, vec, kw };
    })
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK);

  return {
    usedVector,
    results: ranked.map(({ evidence, rrf, vec, kw }) => ({
      ...evidence,
      rrfScore: rrf,
      ...(vec ? { vectorScore: vec.item.vectorScore } : {}),
      ...(kw ? { keywordScore: kw.item.keywordScore } : {}),
    })),
  };
}
