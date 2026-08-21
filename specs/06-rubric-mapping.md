# Scoring Rubric → Requirements Traceability

The challenge rubric (300 points, 6 categories). Every category maps to concrete
features/tasks so nothing is missed. This is the checklist we build against.

---

## 1. کیفیت و صحت پاسخ‌ها — 80 pts (answer quality & correctness)
| Sub-criterion | Implementation |
|---|---|
| صحت و مرتبط بودن (accuracy/relevance) | RAG retrieval + rerank + grounding prompt ("answer only from sources") |
| کامل و کاربردی بودن (complete & actionable) | Step-by-step synthesis + code/CLI snippets + next-step suggestion |
| پیدا کردن اطلاعات مناسب (finding right info) | `search_docs` (hybrid vector+trigram/RRF) + `get_doc` tools; multi-step retrieval |
| کاهش پاسخ نادرست/ساختگی (reduce hallucination) | "I don't know" threshold + citation requirement + verifier pass |
| ارائه منبع مناسب (proper sourcing) | Inline `[n]` citations → docs.liara.ir links (from `Original link:`) |
| سوالات ساده و پیچیده (simple & complex Qs) | Single-shot RAG for simple; ReAct loop for complex/multi-step |

## 2. طراحی UI و UX — 55 pts
| Sub-criterion | Implementation |
|---|---|
| کیفیت طراحی و سادگی (design quality) | shadcn/ui (customized) + taste-skill design direction; no default state |
| تجربه مکالمه (conversation UX) | streaming, step indicators, typing/loading states |
| نمایش کد/لینک/اطلاعات فنی | code blocks + copy button + inline citations + sources panel |
| ادامه Conversation | thread history, context across turns (existing), follow-up handling |
| Responsive | mobile sidebar (existing), shadcn primitives |
| جزئیات UX | RTL, Persian font (Vazirmatn), Persian digits, empty/error states |

## 3. قابلیت‌های Agentic و Personalization — 50 pts
| Sub-criterion | Implementation |
|---|---|
| درک صحیح Intent | query router (service detection) + tool selection |
| پرسیدن سؤال تکمیلی (ask clarifying Q) | **NEW:** if intent ambiguous, agent asks one clarifying question before searching |
| حفظ Context مکالمه | full thread passed to the loop; conversation memory |
| شخصی‌سازی پاسخ‌ها (personalization) | answer-depth setting (مبتدی/حرفه‌ای) + service/stack awareness |
| پیشنهاد قدم بعدی (suggest next step) | **NEW:** every answer ends with a concrete "next step" suggestion |
| فرآیندهای چندمرحله‌ای (multi-step) | ReAct loop (search → read → refine → answer) |
| استفاده خلاقانه از Agentic | tools visible in UI ("🔍 Searching…", "📖 Reading…") |

## 4. امنیت، پایداری و Monitoring — 50 pts
| Sub-criterion | Implementation |
|---|---|
| Rate limiting | Neon-backed per-user fixed-window + burst cap before paid API calls; `429` + `Retry-After` |
| مدیریت API Key/Secret | keys only in server env (`AVALAI_API_KEY`); never client-side; `.env` gitignored (already) |
| مدیریت خطا و Failure | fallback chain (3 models) + degrade to single-shot RAG + user-facing error states |
| کنترل مصرف Token | token caps (`max_tokens`), 3-iteration cap, prompt caching, no redundant calls |
| Logging و Monitoring | structured logging (pino) + per-request model/latency/tokens; error capture |
| معماری قابل توسعه | modular: `ingest.ts` / `rag.ts` / `agent.ts` / route — already in plan |

## 5. استقرار روی زیرساخت لیارا — 40 pts ✅ (Vercel accepted)
| Sub-criterion | Implementation |
|---|---|
| اجرای موفق | **Deploy on Vercel** — organizer confirmed Vercel earns these points; no Liara required |
| کیفیت Deployment | env vars configured on Vercel; build succeeds in their pipeline |
| Configuration مناسب | `next start` runtime, correct port, `DATABASE_URL` + `AVALAI_API_KEY` |
| آماده Production | health check, graceful fallback, no dev-only code paths |

**Resolved:** Vercel-only. No `liara.json` needed.

## 6. بهینه‌سازی هزینه — 25 pts
| Sub-criterion | Implementation |
|---|---|
| انتخاب مدل/سرویس مناسب | cheap models chosen (`deepseek-v4-flash`, `text-embedding-3-small`) |
| کنترل مصرف Token | `max_tokens` caps, 3-iteration cap, chunk-size tuned |
| کاهش درخواست غیرضروری | no redundant tool calls; single model (no separate router/verifier) |
| استفاده از Cache | **prompt caching** (DeepSeek) + response cache for repeated questions |
| هزینه زیرساخت | reuse Neon (no new DB service); serverless-friendly |
| تعادل کیفیت/هزینه | fallback to cheaper model first; verifier only when needed |

---

## Priority ordering (by points)
1. Answer quality (80) — the core RAG + grounding + citations
2. UI/UX (55) — shadcn + taste-skill + RTL + Persian
3. Agentic/personalization (50) — ReAct + clarifying Q + next-step + personalization
4. Security/monitoring (50) — rate limit + logging + fallback + token control
5. **Deployment (40) — Vercel accepted by organizer; production checks still required**
6. Cost (25) — caching + cheap models