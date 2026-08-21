# Implementation Plan — Liara Docs Agent

## 0. Technical decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 App Router (existing) | Already deployed; spec-compliant |
| Language | TypeScript, full-stack Next | matches existing app |
| LLM access | **Aval AI** (`https://api.avalai.ir/v1`) via existing OpenAI SDK — 18 approved models only | OpenAI-compatible; one new key `AVALAI_API_KEY` |
| Generation | `deepseek-v4-flash` → `qwen3.7-plus` → `glm-5.2` (all tool-calling) | cheap, strong multilingual, 3-provider fallback (see 05-llm-decisions) |
| Embeddings | `text-embedding-3-small` only at runtime (1024d); `text-embedding-3-large` only via full re-index migration | never mix embedding model spaces; keyword-only degradation on outage |
| Vector store | Neon Postgres + `pgvector` (`hnsw`), column `vector(1024)` | reuse existing DB; drizzle-orm has built-in `vector()` type |
| Agent pattern | Hand-written ReAct loop via OpenAI SDK **function calling**, single model, max 3 iterations | **locked — no LangChain/LangGraph**; rpm-friendly |
| Retrieval | **Hybrid**: vector + `pg_trgm` keyword, fused with **RRF** (reciprocal-rank) | semantic alone fails on endpoints/error strings |
| UI framework | **shadcn/ui** (Radix primitives, customized) + **taste-skill** design direction | per user requirement |
| Layout / i18n | **RTL-first, Persian** — `Vazirmatn` font, `dir="rtl"`, Persian digits | core audience is Persian users |
| Streaming | Existing SSE text stream + JSON "step" events | minimal UI churn |
| Ingestion trigger | Local/CI `npm run ingest`; optional GitHub Actions `workflow_dispatch` | never run long ingestion inside Vercel request |
| Source of truth | `public/llms/**/*.md` from `liara-cloud/docs@master` | pre-built LLM corpus (1,143 files) |
| Deployment | **Vercel only** (Liara not required — organizer confirmed) | no `liara.json` |

## 1. Architecture

```
┌───────────────────────────── Next.js (full-stack) ─────────────────────────────┐
│                                                                                 │
│  Ingestion (scripts/ingest.ts)                                                  │
│    tarball of liara-cloud/docs → parse public/llms/**/*.md → chunk (markdown-   │
│    aware) → embed (text-embedding-3-small, 1024d) → upsert Neon pgvector        │
│                                                                                 │
│  Retrieval (src/lib/rag.ts)                                                     │
│    query → vector search (pgvector cosine) + keyword search (pg_trgm)           │
│          → RRF fusion → top-k chunks with metadata                              │
│                                                                                 │
│  Chat route (app/api/chat/route.ts — REWRITTEN)                                │
│    user msg → [single-model ReAct loop: search_docs / get_doc / list_docs /     │
│    ask_user] → grounded Persian answer + citations + confidence + next-step     │
│    → stream answer + step events                                                │
│                                                                                 │
│  UI (shadcn/ui + taste-skill, RTL)                                              │
│    agent steps · sources panel · citations · code+copy · confidence · 👍👎      │
└─────────────────────────────────────────────────────────────────────────────────┘
      │ DB: Neon Postgres + pgvector + pg_trgm   │ LLM: Aval AI (18 approved models)
```

## 2. Dependencies to add

```jsonc
// runtime
"pino"               // structured logging (rubric 4)
// dev
"tsx"                // run scripts/ingest.ts
// UI (shadcn/ui, added via CLI not package.json)
//   - shadcn components into src/components/ui/*  (Radix + class-variance-authority + tailwind-merge)
// fonts
//   - Vazirmatn via next/font (or @fontsource/vazirmatn)
```
No LangChain, no new framework. (If Neon lacks pgvector, use drizzle raw SQL to
`CREATE EXTENSION vector`.)

## 3. Data model changes (src/db/schema.ts)

New table `doc_chunks`:
```ts
docChunks = pgTable("doc_chunks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  service:   text("service").notNull(),          // paas | dbaas | iaas | ai | ...
  path:      text("path").notNull(),             // e.g. paas/nextjs/getting-started
  title:     text("title").notNull(),
  sourceUrl: text("source_url").notNull(),       // https://docs.liara.ir/paas/nextjs/getting-started/
  heading:   text("heading"),                    // nearest heading for context
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  contentHash: text("content_hash").notNull(),          // stable incremental-ingest key
  embeddingModel: text("embedding_model").notNull(),    // prevents mixed vector spaces
  embedding: vector("embedding", { dimensions: 1024 }), // fixed to 1024 (see 05-llm-decisions)
  metadata:  jsonb("metadata"),
  indexedAt: timestamp("indexed_at").defaultNow(),
});
```
Indexes/constraints: unique `(path, chunk_index, content_hash)` for idempotent ingestion;
`hnsw` (vector cosine ops) on `embedding`; GIN trigram index on `chunk_text` plus trigram
indexes on `title`/`path` where useful. Drizzle-orm ships a built-in `vector()` column type.

Existing table extensions:
- `chat_messages.metadata jsonb` stores source cards, confidence/evidence summary, agent
  steps, model used, and schema version so historical messages render identically.
- `chat_settings.answer_depth` enum-like text (`beginner` | `professional`).
- Never persist chain-of-thought; only compact evidence summary and tool-step labels.

## 4. Module breakdown

### 4.1 `src/lib/ingest.ts` — parser + chunker
- `fetchRepoFiles()`: stream GitHub tarball `https://github.com/liara-cloud/docs/archive/refs/heads/master.tar.gz` (or `git clone --depth 1`), extract `public/llms/`.
- `parseMarkdown(text, path)`: extract `Original link:`, first `#` title, headings, strip nav-only noise.
- Normalize Persian retrieval text consistently at ingest/query time: Arabic `ي/ك` to Persian `ی/ک`, normalize whitespace/ZWNJ and Unicode form; preserve original text for display/citation.
- `chunkMarkdown(text)`: split by headings; then size-split (~600–1000 tokens) with ~15% overlap; keep heading breadcrumb.
- `embed(texts)`: `text-embedding-3-small` (1024d) batched; retry/backoff + dim-check. Never mix models in one index. On query embedding outage, hybrid retrieval degrades to keyword-only.
- `upsert(chunks)`: `INSERT ... ON CONFLICT DO UPDATE` (or truncate + insert per index version).

### 4.2 `src/lib/rag.ts` — hybrid retrieval
- `embedQuery(q)` → vector.
- `vectorSearch(q, {topK, service?, minScore})` → `SELECT ... ORDER BY embedding <=> $1 LIMIT k`.
- `keywordSearch(q, {topK, service?})` → `pg_trgm` similarity on `chunk_text` / `title` / `path` (`ILIKE`/`%` trigram GIN index); no model needed, works for Persian + code/endpoints.
- `hybridSearch(q, opts)` → run both, fuse with **RRF** (reciprocal-rank fusion), return top-k with `vectorScore`, `keywordScore`, `rrfScore`, `sourceUrl`, `title`, `service`, `heading`, `method`/`endpoint` metadata. If embedding fails, return keyword ranking only.
- Confidence is calibrated from raw vector/keyword evidence and source agreement — **not from RRF score**, since RRF is ordinal and not a probability.

### 4.3 `src/lib/agent.ts` — ReAct loop (function calling)
- Tools (declared as OpenAI function schemas):
  - `search_docs(query, service?)`
  - `get_doc(path)` → full markdown for a page
  - `list_docs(service?)` → titles+paths (uses `all-links-llms.txt` snapshot or DB)
  - `ask_user(question)` → request one clarifying question when intent is ambiguous (rubric 3)
- Loop: call model with tools → if tool_call, execute, append result, repeat (max **3**).
- Single model (`deepseek-v4-flash`) drives the whole loop; grounding enforced by prompt
  ("answer only from provided sources; say you don't know otherwise") — no separate critic call.
- Every answer must end with a **next-step suggestion** (rubric 3).
- Emit "step" events: `{type:'step', label, detail}` for UI progress.
- Auto-fallback across the 3 Aval chat models on error/timeout (see 05-llm-decisions §4).

### 4.4 `app/api/chat/route.ts` — REWRITE
- Keep auth, thread/message persistence, provider fallback.
- New flow:
  1. Save user msg (existing).
  2. Single-model ReAct loop (streaming step events): intent → tools (`search_docs`/`get_doc`/`list_docs`/`ask_user`) → evidence → refine if needed (max 3 iterations).
  3. Synthesize grounded Persian answer from retrieved chunks (cite `[n]`).
  4. Attach citations + confidence + next-step suggestion; stream answer + steps.
- Response shape: keep `text/plain` token stream for existing UI; send step events as
  SSE `data:` lines with a `type` discriminator. **Decision:** evolve the existing route
  to stream both `step` and `token` events with a light event protocol; update `useChat.ts`
  to parse them. No separate critic/verifier model (grounding via prompt + threshold).

### 4.5 UI (`src/components/chat/*`, `src/hooks/useChat.ts`)
- **Migrate to shadcn/ui** (Radix primitives): button, input, textarea, dialog/sheet
  (sidebar + settings), tooltip, dropdown, avatar, scroll-area, separator, badge, skeleton.
  Customize tokens (not default state) per taste-skill.
- **taste-skill** as the design-direction skill (installed at `.claude/skills/design-taste-frontend/SKILL.md`);
  run its brief-inference before writing UI; RTL + Persian-first constraints layered on top.
- `AgentSteps` component: animated list of steps with status ("🔍 Searching…", "📖 Reading…").
- `Sources` component: numbered citations linking to docs.liara.ir.
- `MessageBubble`: render citations `[n]` as superscript links; code blocks with copy button.
- **RTL/Persian**: `dir="rtl"` on `<html>`, Vazirmatn font (via `next/font`), Persian digit
  rendering, mirrored layout, LTR isolation for code/URLs (`dir="ltr"` spans).
- Personalization: answer-depth toggle (مبتدی / حرفه‌ای) in SettingsDrawer.
- Keep threads/history/model-picker intact; add clarifying-question UI (agent asks, user answers inline).

### 4.6 `scripts/ingest.ts` + optional GitHub Actions workflow
- `npm run ingest` runs locally/CI; content hashes skip unchanged chunks.
- Optional `.github/workflows/reindex.yml` uses `workflow_dispatch` with repository
  secrets. No Vercel re-index endpoint: 1,143 docs + Aval rate limits exceed safe
  serverless request duration.

### 4.7 Rate limiting, logging, observability (rubric 4 — 50 pts)
- Rate limit `/api/chat` with the existing Neon DB: per-user fixed-window counters plus a short burst cap. No Upstash/new service. Apply before embedding/LLM calls; return `429` + `Retry-After`.
- Structured logging (pino): per-request model, latency, tokens, steps, errors.
- Token budget controls: `max_tokens` caps, 3-iteration cap, prompt caching.
- Never expose keys client-side; `AVALAI_API_KEY` server-only.

*(Liara deployment removed — organizer confirmed Vercel earns the deployment points.)*

## 5. Ingestion strategy (hackathon-pragmatic)
- Build a **pre-indexed snapshot**: run ingest once, store chunks in Neon. App
  reads Neon at query time. No build-time DB dependency.
- Provide `npm run ingest` + optional manual GitHub Actions workflow for updates.

## 6. Testing / verification plan
- **Unit**: chunker splits correctly on a sample Persian markdown; citation URL parsed.
- **Retrieval**: known questions ("دیپلوی Next.js") return the right `paas/nextjs` chunk top-1; endpoint query (`POST /v1/databases`) returns the DBaaS API page via keyword/RRF.
- **Grounding**: adversarial prompt ("give me the secret password") → refusal / "not found".
- **End-to-end**: seed a few docs, run `npm run dev`, ask the 3 acceptance questions, check citations.
- **Manual + video**: record the 5-min demo on the deployed URL.

## 7. Milestones (ordered)
1. **M1 — Vector store + ingestion** (schema, pgvector + pg_trgm, parser, chunker, embed, ingest script).
2. **M2 — Hybrid retrieval + minimal RAG** (`hybridSearch` RRF + `/api/chat` retrieve→synthesize, no tools yet).
3. **M3 — Agentic loop** (tools, ReAct, step events, clarifying-question, next-step).
4. **M4 — UI** (shadcn + taste-skill + RTL; steps + sources + citations + confidence).
5. **M5 — Deploy + polish** (Vercel env, re-index, rate-limit, logging, video demo).

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Neon may not have pgvector/pg_trgm enabled | enable extensions via raw SQL; drizzle-orm has built-in `vector()` type |
| Embedding model quota/limits | cache embeddings in DB; batch + retry/backoff; query-time keyword-only degradation. Switching model requires full re-index |
| **Free-tier rpm (1–3 req/min)** | cap ReAct at 3 iterations; single model (no router/verifier); batch embeddings; recommend $1–2 top-up for tier 1 (25 rpm) |
| Persian embedding/keyword quality | `text-embedding-3-small` multilingual; `pg_trgm` is language-agnostic; evaluate top-k on sample Qs |
| Free LLM tool-calling unreliable | prompt-enforced grounding + fallback to single-shot RAG; short timeouts; 3-provider chain |
| Agent loop latency | cap iterations (3), cap tokens, parallelize independent tool calls |
| Next 16 breaking changes | consult `node_modules/next/dist/docs/` before API changes (AGENTS.md) |