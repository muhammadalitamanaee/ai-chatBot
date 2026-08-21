# LLM Decisions — Aval AI (locked, v2)

Source of truth: Aval AI live catalog `https://api.avalai.ir/public/models`
(fetched 2026-08-21). Constraint: **only the 18 user-approved models** are used.

- **API base URL:** `https://api.avalai.ir/v1`
- **Auth:** `Authorization: Bearer <AVALAI_API_KEY>` (OpenAI-compatible → existing OpenAI SDK)
- **Endpoints:** `/v1/chat/completions`, `/v1/embeddings`

---

## 1. Embedding model (ingestion + query)

| Role | Model ID | Price (in) | Dims (requested) | rpm |
|---|---|---|---|---|
| **Index + query** | `text-embedding-3-small` | $0.02 / 1M | 1024 via `dimensions` | 3 |
| **Migration alternative only** | `text-embedding-3-large` | $0.13 / 1M | 1024 via `dimensions` | 3 |

**Canonical dimension = 1024.** Every stored document vector and every query vector must
come from the **same embedding model**. Equal dimensions do not mean equal vector spaces;
therefore `text-embedding-3-large` is **not a runtime fallback** for an index built with
`text-embedding-3-small`. On embedding failure, retry `text-embedding-3-small` with
backoff; if it remains unavailable, return a keyword-only retrieval result. Switching to
`text-embedding-3-large` requires a full re-index under a new `embedding_model` version.
Runtime dim-check rejects any response that is not 1024-d.

**Cost:** ~1,143 docs → ~5M tokens ≈ **$0.10** once. Queries negligible.

---

## 2. Generation model (agent loop → answer)

| Role | Model ID | in/out | Tool calling | Cache | ctx | rpm | min_tier |
|---|---|---|---|---|---|---|---|
| **Primary** | `deepseek-v4-flash` | $0.22/$0.66 | ✅ | ✅ | 1M | 3 | 0 |
| Fallback 1 | `qwen3.7-plus` | $0.40/$1.60 | ✅ | — | 1M | 3 | 0 |
| Fallback 2 | `glm-5.2` | $1.40/$4.40 | ✅ | ✅ | 991K | 3 | 0 |

**Why `deepseek-v4-flash`:** cheapest quality model with tool-calling, **prompt caching**
(the agent loop resends the system prompt + history every iteration — caching cuts that
cost massively), 1M context (roomy for grounding prompts), 3 rpm. Strong multilingual.

**Why these fallbacks:** three *different* providers (DeepSeek → Alibaba → Zhipu) so a
provider outage can't take us down; all tool-calling so the agent loop survives fallback.

**Cost:** ~$0.001–0.002 per single answer; agent loop (~3 cached calls) ≈ **$0.003/question**.

### If Persian quality disappoints in testing
Qwen/Alibaba is reputedly the strongest Persian multilingual here. The fallback chain
already contains `qwen3.7-plus`, so flipping primary is a one-line change. **Test both
on the acceptance questions in M2 and pick the winner empirically.**

---

## 3. ⚠️ Model list caveats (from the live catalog)

- `qwen3.8-max` and `qwen3.8-2.4t-a95b` are **`min_tier: 1`** — gated behind a paid Aval
  tier, so they likely won't work on free credit. Not used.
- `deepseek-v4-pro` caps output at 8192 tokens — fine for answers, not for bulk work. Not used as primary.
- `nemotron-3.5-lightning` ($0.05) is cheapest but Persian quality is unproven — kept out of the primary slot.
- `text-embedding-3-large` is 6.5× the price of small for modest quality gain — fallback only.

---

## 4. Fallback system (auto-switch on failure)

```
embed query:
  text-embedding-3-small ──fail──▶ retry with backoff ──fail──▶ keyword-only retrieval
  (text-embedding-3-large requires a full re-index; never mixed at runtime)

generate (agent loop):
  deepseek-v4-flash ──fail──▶ qwen3.7-plus ──fail──▶ glm-5.2
```

Trigger: HTTP/network error, 15s timeout, malformed response, or missing tool-calling.
On "no tool-calling" → degrade to single-shot RAG (never crash the chat).

**Note:** the legacy OpenRouter/GapGPT keys are no longer in the fallback chain — the
approved-model constraint supersedes them. They can be removed from `.env` later.

---

## 5. Free-tier rate limits (real bottleneck, not tokens)

| Model | tier-0 rpm | tpm |
|---|---|---|
| `deepseek-v4-flash` | 3 | 40k |
| `qwen3.7-plus` | 3 | 40k |
| `text-embedding-3-small` | 3 | 40k |

An agent loop makes several sequential calls per question. Mitigations (implemented):
1. Cap ReAct at **3 iterations**; single model (no separate router/verifier).
2. **Prompt caching** (DeepSeek) — cached tokens bill at the much lower `cached_input` rate.
3. Embeddings batched (array `input`) — ingestion is offline, 3 rpm is manageable with backoff.
4. Do not assume a paid tier is required: benchmark tier-0 burst behavior first. Top up only if live tests show throttling.