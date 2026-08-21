# Tasks — Liara Docs Agent

Ordered, dependency-aware task list. Each task is independently implementable and
verifiable. Estimate: hackathon-scale, build M1→M5 in order.

---

## M1 — Vector store + ingestion

### T1.1 Enable pgvector + pg_trgm + schema
- [ ] Add `doc_chunks` table to `src/db/schema.ts` (fields per plan §3), including `content_hash`, `embedding_model`, and idempotent unique key.
- [ ] Write `src/db/migrate-vector.sql` (or drizzle migration): `CREATE EXTENSION IF NOT EXISTS vector;` + `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `hnsw` index on embedding + `GIN (chunk_text gin_trgm_ops)` index.
- [ ] Verify table + indexes exist in Neon.

### T1.2 Doc fetch + parse
- [ ] `src/lib/ingest.ts` — `fetchDocs()`: stream GitHub tarball, extract `public/llms/`.
- [ ] `parseMarkdown()`: extract `Original link:`, `title` (first `#`), headings.
- [ ] Normalize Persian search text (`ي/ك`, Unicode, whitespace/ZWNJ) at ingest and query; retain original display text.
- [ ] Skip noise files (index pages with only nav links, empty chunks).

### T1.3 Chunker
- [ ] `chunkMarkdown()`: heading-aware split + token-size cap (~800) + overlap (~15%).
- [ ] Unit test on a real Persian file (e.g., `paas/nextjs/getting-started`).

### T1.4 Embed + upsert
- [ ] `embed()`: `text-embedding-3-small` (1024d) batched; retry/backoff + dim-check. Never mix embedding models in one index; on query failure degrade to keyword-only.
- [ ] `upsertChunks()`: batch insert with conflict handling; store service/path/title/url/heading.
- [ ] `scripts/ingest.ts` (`npm run ingest`) end-to-end: fetch → parse → chunk → content-hash/diff → embed changed chunks → store.

**Exit check:** `doc_chunks` populated (target ~6–10k rows), `hybridSearch` returns sane rows.

---

## M2 — Hybrid retrieval + minimal RAG

### T2.1 `src/lib/rag.ts`
- [ ] `embedQuery()` + `vectorSearch(q, {topK, service?, minScore})` using `<=>` cosine.
- [ ] `keywordSearch(q, {topK, service?})` via `pg_trgm` similarity on `chunk_text`/`title`/`path`.
- [ ] `hybridSearch(q, opts)` → RRF fusion of the two lists → top-k with score + metadata; `minScore` low-confidence flag.

### T2.2 RAG answer (no tools yet)
- [ ] Rewrite `app/api/chat/route.ts`: hybrid retrieve → build grounded prompt (chunks + "cite [n]") → stream.
- [ ] Attach sources to final response; keep auth/persistence/fallback intact.
- [ ] Manual test: "چطور Next.js دیپلوی کنم؟" returns cited steps; "POST /v1/databases" returns the DBaaS API page.
- [ ] Run a small Persian evaluation set (conceptual, exact API, troubleshooting, multi-step, unsupported). Compare `deepseek-v4-flash` vs `qwen3.7-plus` blind on groundedness, completeness, citations, latency, and cost. Keep DeepSeek primary only if it wins the weighted rubric score; otherwise flip primary to Qwen.

**Exit check:** hybrid single-shot RAG works end-to-end with citations, and generation-model choice has empirical Persian results.

---

## M3 — Agentic loop

### T3.1 Tool definitions
- [ ] `src/lib/agent.ts` — declare OpenAI function schemas: `search_docs`, `get_doc`, `list_docs`, `ask_user`.
- [ ] Implement tool executors against `rag.ts` + `all-links-llms.txt` snapshot.

### T3.2 ReAct loop
- [ ] Loop with max **3** iterations; append tool results as messages; 15s timeouts per call.
- [ ] Emit `step` events (`searching…`, `reading…`, `verified`).
- [ ] Single model (`deepseek-v4-flash`) drives the loop; grounding via system prompt (cite-only-sources).
- [ ] Clarifying-question path: ambiguous intent → `ask_user` → pause loop for user answer.
- [ ] Next-step suggestion appended to every final answer.

### T3.3 Fallback
- [ ] On error/timeout, auto-switch `deepseek-v4-flash` → `qwen3.7-plus` → `glm-5.2`.
- [ ] If tool-calling errors/unsupported → degrade to M2 single-shot RAG (never crash).

### T3.4 Personalization
- [ ] Answer-depth setting (مبتدی / حرفه‌ای) threaded into the system prompt.

**Exit check:** multi-step question ("اپم بالا نمیاد، ارور DNS") triggers tools + cites sources + shows steps.

---

## M4 — UI (shadcn + taste-skill + RTL)

### T4.0 Design system setup
- [ ] `npx shadcn@latest init` (Tailwind v4 already present) + add primitives (button, input,
      textarea, sheet, dialog, dropdown-menu, tooltip, avatar, scroll-area, separator, badge, skeleton).
- [ ] Load taste-skill (installed at `.claude/skills/design-taste-frontend/SKILL.md`), write a
      one-line design read, set the 3 dials, customize shadcn tokens (not default state).
- [ ] Vazirmatn font via `next/font`; `dir="rtl"` on `<html>`; Persian digits; LTR isolation for code/URLs.

### T4.1 Agent steps component
- [ ] `src/components/chat/AgentSteps.tsx` — animated progress list (shadcn skeleton/badge).
- [ ] `useChat.ts` — parse step events + token stream.

### T4.2 Sources + citations + code
- [ ] `src/components/chat/Sources.tsx` — numbered source links.
- [ ] `MessageBubble.tsx` — `[n]` superscript citations + code blocks with copy button.

### T4.3 Clarifying-question + personalization UI
- [ ] Inline clarifying-question render (agent asks → user answers in chat).
- [ ] Answer-depth toggle (مبتدی / حرفه‌ای) in SettingsDrawer.

### T4.4 Persian + polish
- [ ] Persian copy across new components; responsive (mobile sidebar); RTL mirrored layout.

**Exit check:** RTL Persian UI on shadcn shows steps + citations + copy buttons; existing
threads/settings/model-picker still work.

---

## M5 — Security, monitoring, deploy + demo

### T5.1 Rate limiting + logging
- [ ] Neon-backed per-user fixed-window + burst rate limit on `/api/chat`; enforce before paid calls; return `429` + `Retry-After`.
- [ ] pino structured logging: model, latency, token counts, step labels, errors. Never log keys, full prompts, or full retrieved text.

### T5.2 Environment + re-index
- [ ] Vercel env vars (`AVALAI_API_KEY`, existing auth/DB keys).
- [ ] Run production ingest locally/CI; optional GitHub Actions `workflow_dispatch`. No long-running Vercel admin endpoint.

### T5.3 Acceptance tests
- [ ] Run the 3 spec acceptance questions on the live URL; verify citations + grounding.
- [ ] Adversarial "not in docs" prompt → honest refusal.
- [ ] Persian RTL UX check on mobile + desktop.

### T5.4 Demo video
- [ ] 5-min video: end-to-end journeys, architecture overview, edge-case handling.

---

## Definition of done (whole project)
- [ ] Live deployed app answers from Liara docs with citations.
- [ ] Agentic loop demonstrable (steps visible, multi-step guidance).
- [ ] Grounded: evidence threshold + citation contract prevent unsupported claims; refusals when unsure.
- [ ] Existing chatbot features intact.
- [ ] Persian works; code/CLI rendered.
- [ ] Demo video recorded.