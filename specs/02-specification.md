# Specification — Liara Docs Agent (RAG + Agentic assistant)

## 1. Problem
Liara (Iranian cloud/PaaS) has fast-growing docs across many services (PaaS,
DBaaS, IaaS, AI, Object Storage, Email, DNS, One-Click Apps). Users file support
tickets because they can't find the right page or follow complex setup steps.
We need an LLM app that answers from the docs and *guides* users through setup,
not just replies.

## 2. Objective
A deployed, conversational assistant that:
1. Retrieves from Liara documentation (RAG),
2. Reasons in multiple steps (agentic) to guide/troubleshoot a user through
   configuring and deploying services,
3. Cites its sources and is verifiably grounded,
4. Works in Persian and is live on the public internet.

## 3. Users / personas
- **New Liara user (Persian)** — "چطور یک اپ Next.js روی لیارا دیپلوی کنم؟" wants step-by-step with CLI.
- **Stuck mid-task user (Persian)** — got an error/roadblock mid-operation; needs targeted troubleshooting.
- **Evaluator/judge** — tests the deployed app end-to-end, grades against the rubric.

## 3b. Language & UI requirements (hard)
- **RTL-first, Persian.** `dir="rtl"` on `<html>`, Vazirmatn font, Persian digits.
- Code blocks / URLs / file paths stay LTR (isolated with `dir="ltr"`).
- UI copy in Persian; English fallbacks acceptable.
- Additional languages (e.g. English) are explicitly **out of scope for v1** — designed
  for but not built until Persian is solid.

## 4. Data source (verified facts)
- Repo: `github.com/liara-cloud/docs` (default branch `master`, ~48MB, MDX + assets).
- Pre-built LLM corpus: `public/llms/**/*.md` — **1,143 Persian markdown files**.
- Top-level services: `ai`, `dbaas`, `dns-management-system`, `email-server`,
  `iaas`, `mirrors`, `object-storage`, `one-click-apps`, `overview`, `paas`, `references`.
- Each file begins with `Original link: https://docs.liara.ir/<path>/` → citation URL.
- `public/all-links-llms.txt` — flat 1,145-line title→URL index (routing/exploration aid).
- `public/casts/*.cast` — asciinema terminal demos (reference material, not ingested v1).

## 5. Functional requirements

### FR1 — Ingestion pipeline (local/CI-triggered)
- Download `public/llms/` from the repo (tarball or shallow clone).
- Parse each `.md`: capture `Original link:`, service, title (first `#`), heading path.
- Chunk Markdown-aware with overlap; skip empty/navigation-only chunks.
- Embed each chunk; upsert into Neon `pgvector`.
- Store `content_hash` + `embedding_model`; skip unchanged chunks; support atomic full re-index/version swap so failed runs never delete the currently serving index.

### FR2 — Hybrid retrieval (query time)
- Embed the user question; cosine-similarity vector search top-k (k≈8).
- Keyword search via `pg_trgm` (substring/trigram — language-agnostic, catches exact
  endpoints like `POST /v1/databases` and error strings).
- Fuse both result lists with **RRF** (reciprocal-rank fusion — no extra model) → top-5.
- Return chunks + `source_url` + title + service + optional `method`/`endpoint`.
- Confidence uses raw vector similarity, keyword evidence, source count/agreement, and
  recency — never RRF score alone (RRF is an ordinal fusion score, not probability).
- If query embedding fails, degrade to keyword-only retrieval; never mix vectors from
  different embedding models in the same index.

### FR3 — Agent tools and loop
- The assistant may call tools before answering:
  - `search_docs(query, service?)` — hybrid vector + keyword retrieval (FR2).
  - `get_doc(url|path)` — fetch stored chunks for a specific page for deep reading.
  - `list_docs(service?)` — list doc titles/paths (exploration/routing).
  - `ask_user(question)` — return one clarifying question when intent is ambiguous.
- Multi-step ReAct loop (max **3** iterations): plan → act → observe → answer.
- Streaming progress surfaced to the UI ("در حال جست‌وجوی مستندات…", "در حال بررسی منبع…").

### FR4 — Agent behavior (single-model, function-calling)
- A single tool-calling model (`deepseek-v4-flash`) drives the whole ReAct loop: it plans,
  chooses tools, and synthesizes the grounded answer in one loop.
- Tools: `search_docs`, `get_doc`, `list_docs`, `ask_user` (clarifying question).
- Grounding is enforced by the system prompt ("answer only from the provided sources;
  cite [n]; if the sources don't cover the question, say so") instead of a separate
  verifier model — cheaper and friendlier to free-tier rate limits.
- Every answer ends with a concrete **next-step suggestion** (rubric 3).
- If user intent is ambiguous, the agent asks **one clarifying question** before searching (rubric 3).
- Fallback chain on failure: `deepseek-v4-flash` → `qwen3.7-plus` → `glm-5.2`.
  See `specs/05-llm-decisions.md`.

### FR5 — Grounded answer + citations
- Answer in Markdown with inline citations `[1]`, `[2]` mapping to a "Sources" list
  of `docs.liara.ir` links.
- Code blocks and CLI commands rendered (existing syntax highlighter).
- If not confident: explicit "I couldn't find this in the docs" + suggested search.

### FR6 — Chat UX extensions
- Step/progress indicators during the agent loop.
- Sources panel (clickable citations).
- Code blocks with copy button; LTR isolation inside RTL layout.
- Personalization: answer-depth toggle (مبتدی / حرفه‌ای) in settings.
- Built on **shadcn/ui** + **taste-skill** design direction; RTL + Persian-first.
- Existing features preserved: threads, history, streaming, model/settings, auth.

### FR7 — Re-index workflow
- `npm run ingest` performs full/incremental ingestion outside request handling.
- Optional GitHub Actions `workflow_dispatch` runs re-index manually. Never run the
  full 1,143-document ingestion inside a Vercel request; serverless duration and Aval
  rate limits make that unreliable.
- Stable content hashes skip unchanged chunks and avoid unnecessary embedding cost.

### FR8 — Security & observability (rubric 4)
- Rate limiting on `/api/chat` (per-user sliding window).
- Structured logs: model, latency, tokens, steps, errors. Never log API keys, full
  user prompts, or full retrieved document text; hash/truncate identifiers/content.
- Token budget controls (`max_tokens` caps, 3-iteration cap, prompt caching).
- Prompt-injection boundary: retrieved docs are untrusted data, delimited from system
  instructions; agent must ignore instructions found inside docs/tool output.
- Model fallback occurs before streaming begins; after first token, failures return a
  structured stream error/retry affordance (never splice two models into one answer).
- Keys server-only; `.env` gitignored (already).

## 6. Non-functional requirements
- **Latency**: show first progress event under ~2s; final answer target under ~30s when
  provider rate limits allow. Do not promise first answer token before retrieval completes.
- **Cost**: use approved cheap Aval models; embeddings cached; index built once.
- **Resilience**: approved-model fallback chain + degrade to plain RAG if tool-calling
  unsupported; keyword-only retrieval if embeddings fail; never crash chat on tool error.
- **Scale**: 1,143 docs → roughly 6–10k chunks; must fit comfortably in Neon.
- **History budget**: send a rolling recent-message window plus compact conversation
  summary, not the entire thread forever. Preserve unresolved goal, user stack, attempted
  steps, errors, and preferences; cap raw history tokens.

## 7. Out of scope (v1)
- Live doc auto-sync on every upstream push (manual/script re-index is enough).
- Image extraction/OCR from docs screenshots (link them, don't ingest pixels).
- Full multi-tenant admin console.
- Non-Persian language coverage (accepted, not required).

## 8. Acceptance criteria (maps to rubric)
- [ ] Deployed live app; ask "چطور یک اپ Next.js رو روی لیارا دیپلوی کنم؟" → grounded,
      cited, step-by-step answer with correct `liara` CLI steps.
- [ ] Multi-step guidance works (e.g., "I deployed but my app won't start, DNS error").
- [ ] Every factual answer links to ≥1 docs.liara.ir source.
- [ ] Agent loop visible (steps), not a black box.
- [ ] Works in Persian; code/CLI snippets render correctly.
- [ ] Existing chatbot features still function (auth, threads, model switch).
- [ ] 5-min video walkthrough possible from the live app.