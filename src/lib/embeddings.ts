import { getAvalClient } from "./providers";

// ---------------------------------------------------------
// Embedding model — MUST stay fixed for index AND query.
// Never mix `text-embedding-3-large` vectors into this index;
// switching requires a full re-index under a new embedding_model.
// ---------------------------------------------------------
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1024;
const MAX_EMBED_ATTEMPTS = 3;
const EMBED_BASE_RETRY_MS = 2000;
const EMBED_REQUEST_TIMEOUT_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------
// Backoff for embedding requests.
// Respects Retry-After on 429; otherwise exponential backoff.
// Max attempt count is bounded by MAX_EMBED_ATTEMPTS.
// ---------------------------------------------------------
export function computeBackoff(err: unknown, attempt: number): number {
  const error = err as { status?: number; headers?: { get?: (k: string) => string | null; [k: string]: unknown } };
  const status = typeof error?.status === "number" ? error.status : NaN;
  const retryAfter = error?.headers?.get?.("retry-after");
  if (status === 429 || (status >= 500 && status < 600) || retryAfter) {
    if (retryAfter) {
      const secs = Number.parseInt(retryAfter, 10);
      if (Number.isFinite(secs) && secs >= 1) return secs * 1000;
    }
  }
  return Math.min(EMBED_BASE_RETRY_MS * 2 ** (attempt - 1), 60_000);
}

// ---------------------------------------------------------
// Embed a batch of texts (single API request) with retry/backoff.
// Validates the returned dimensionality; rejects any mismatch.
// ---------------------------------------------------------
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getAvalClient();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_EMBED_ATTEMPTS; attempt++) {
    try {
      const response = await client.embeddings.create(
        {
          model: EMBEDDING_MODEL,
          input: texts,
          dimensions: EMBEDDING_DIMS,
          encoding_format: "float",
        },
        // Per-request timeout (so a hung socket triggers retry instead of
        // stalling ingestion) with SDK auto-retries off — our loop handles it.
        { timeout: EMBED_REQUEST_TIMEOUT_MS, maxRetries: 0 },
      );

      const embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding as number[]);

      for (const emb of embeddings) {
        if (emb.length !== EMBEDDING_DIMS) {
          throw new Error(
            `Expected ${EMBEDDING_DIMS} dimensions, got ${emb.length}`,
          );
        }
      }

      return embeddings;
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_EMBED_ATTEMPTS) break;
      const delay = computeBackoff(err, attempt);
      console.warn(
        `[embeddings] Attempt ${attempt}/${MAX_EMBED_ATTEMPTS} failed; retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  throw new Error(
    `Embedding failed after ${MAX_EMBED_ATTEMPTS} attempts: ${String(lastErr)}`,
  );
}

// ---------------------------------------------------------
// Embed a single string and return its vector literal (for pgvector).
// Throws on embedding failure (caller decides keyword-only fallback).
// ---------------------------------------------------------
export async function embedQuery(query: string): Promise<number[]> {
  const [vec] = await embedTexts([query]);
  return vec;
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
