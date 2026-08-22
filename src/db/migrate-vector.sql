-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for doc_chunks table
-- HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks USING hnsw (embedding vector_cosine_ops);

-- GIN trigram index for keyword search on chunk_text
CREATE INDEX IF NOT EXISTS doc_chunks_chunk_text_trgm_idx ON doc_chunks USING gin (chunk_text gin_trgm_ops);

-- GIN trigram index on title for better routing
CREATE INDEX IF NOT EXISTS doc_chunks_title_trgm_idx ON doc_chunks USING gin (title gin_trgm_ops);

-- GIN trigram index on path for endpoint/method lookups
CREATE INDEX IF NOT EXISTS doc_chunks_path_trgm_idx ON doc_chunks USING gin (path gin_trgm_ops);

-- Natural key: one row per (path, chunk_index). Enables
-- INSERT ... ON CONFLICT (path, chunk_index) DO UPDATE so content
-- changes overwrite in place and pending runs leave no stale rows.
DROP INDEX IF EXISTS doc_chunks_unique_idx_legacy;
DROP INDEX IF EXISTS doc_chunks_unique_idx;
CREATE UNIQUE INDEX doc_chunks_unique_idx ON doc_chunks (path, chunk_index);

-- Index for service-based filtering
CREATE INDEX IF NOT EXISTS doc_chunks_service_idx ON doc_chunks (service);

-- Personalization column on chat_settings
ALTER TABLE chat_settings ADD COLUMN IF NOT EXISTS answer_depth text DEFAULT 'beginner' NOT NULL;

-- Evidence/metadata on chat_messages (for source cards + agent steps)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Per-user rate limiting (fixed minute window)
CREATE TABLE IF NOT EXISTS rate_limits (
  window_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
