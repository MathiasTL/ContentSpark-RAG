# Exploration: Content Calendar Generation (Fase 3)

Change: `content-calendar`
Phase: explore
Engram topic: `sdd/content-calendar/exploration`

## Current State

**Backend — models exist and are migrated, everything above them is a stub.**
- `backend/app/models/calendar.py:11-77` — `ContentCalendar` and `ContentEntry` SQLAlchemy models are fully implemented and match `CONTENTSPARK_SAAS_PROJECT.md:213-240` exactly (fields, types, `status` enums as free strings, `google_calendar_event_id` nullable). Relationships: `User.calendars` (`backend/app/models/user.py:28-30`), `ContentCalendar.entries` cascade-deleted, ordered by `ContentEntry.date`.
- Migration `backend/alembic/versions/04bb76c6e29f_init_users_profiles_chats_calendars.py` created both tables already — no new migration needed for the current schema.
- `backend/app/agents/calendar_agent.py:1-4` — comment-only stub. No `StateGraph`, no code.
- `backend/app/agents/shared_state.py:25-34` — `CalendarState` TypedDict already defined (`user_id`, `profile`, `frequency`, `period`, `formats`, `rag_context`, `calendar_entries`, `is_optimized`) but nothing constructs or consumes it yet.
- `backend/app/routers/calendar.py:1-2` — comment-only stub, **not imported/registered in `backend/main.py:8,36-40`**. `backend/main.py` only registers `auth, chat, chats, ingest, profile`.
- `backend/app/schemas/calendar.py:1-30` — three Pydantic models exist (`CalendarGenerateRequest`, `EntryUpdate`, `CalendarResponse`) but none cover `ContentEntry` read/list responses, and `CalendarGenerateRequest` has no field-level validation (e.g. `frequency` unconstrained int, `period` unconstrained str vs. the roadmap's `"current_week"|"next_week"|"month"` closed set).
- No `calendar_service.py` exists in `backend/app/services/` (compare `profile_service.py`, `chat_service.py`).
- `backend/tests/test_calendar.py:1-2` — comment-only stub, present in the pytest suite but empty. `backend/tests/conftest.py:44-49` already stubs `qdrant_search_service`/`llm_service`/`embeddings_service` at import time for tests — the same pattern must be reused for calendar tests.
- **Known boot blocker** (documented in the archived onboarding-profile proposal, `openspec/changes/archive/2026-08-02-onboarding-profile/proposal.md:154-157`): `backend/app/services/qdrant_services.py:37` calls `collection_exists()` on a module-level singleton at import time — `uvicorn main:app` does not boot without live Qdrant credentials. This directly blocks manual testing of any calendar-agent path that touches RAG retrieval, not just profile work.

**Frontend — fully built, entirely mocked, zero wiring to backend.**
- `frontend/features/calendar/CalendarView.tsx` composes `TopBar`, `TimelineCards`, `CalendarGrid`, `GoogleSyncButton`, `PerformancePanel`, `ActivityPanel`, `CreatorTip`.
- `TimelineCards.tsx:17-51` and `CalendarGrid.tsx:13-30` render **hardcoded sample arrays** (`sampleCards`, `events`) — no `fetch`, no hook, no store. `CalendarGrid.tsx:27-29` hardcodes "Octubre 2024" and a fixed day offset — it is not date-aware.
- Every actionable control across `TopBar.tsx`, `GoogleSyncButton.tsx`, `TimelineCards.tsx` is `disabled` with `title="Próximamente"` (pagination, tab switches, sync, entry menu). Only the month/week toggle (`TopBar.tsx:38-58`) has live `useState`.
- No `frontend/features/calendar/services/`, no `frontend/features/calendar/hooks/`, no `frontend/features/calendar/store/` — compare `frontend/features/onboarding/hooks/useOnboardingWizard.ts` and `frontend/features/profile/` which follow a `services/*-api.ts` (`apiFetch` from `frontend/shared/lib/api-fetch.ts`) + Zustand store + hook pattern.
- `frontend/app/(app)/calendar/page.tsx` — thin page importing `CalendarView`, consistent with routing convention.
- **Route guard contradiction**: `frontend/proxy.ts:70` sets `allowWithoutOnboarding = pathname.startsWith("/calendar")`, i.e. `/calendar` is explicitly exempt from the profile-completion redirect that gates `/chat`. This conflicts with the premise that calendar generation requires a complete creator profile — currently a user with zero profile fields can reach `/calendar` freely. This is a real product decision, not a bug to silently fix.

## The Creator-Profile → Calendar Contract

- Profile fields live in `backend/app/models/profile.py:11-38` (`CreatorProfile`): `niche`, `sub_niche`, `primary_goal`, `tone`, `target_audience`, `current_frequency`, `desired_frequency`, `preferred_formats` (JSONB list), plus nested `social_accounts`.
- Reads go through `profile_service.get_or_create_profile(db, user_id)` (`backend/app/services/profile_service.py:43-55`) — never a raw query. The calendar agent/service MUST call this same function (or `GET /api/profile`) rather than re-querying `CreatorProfile` directly, to inherit the "profile row may not exist yet" handling.
- The **completion contract** is `openspec/specs/creator-profile/spec.md:63-97`: `is_complete` is derived from exactly `niche`, `primary_goal`, `tone`, `target_audience` being non-empty — `current_frequency`/`desired_frequency`/`preferred_formats` are explicitly NOT required. This means the calendar agent cannot assume `desired_frequency` or `preferred_formats` are populated even for a "complete" profile; it must have its own fallback (the roadmap's per-niche frequency table, `CONTENTSPARK_SAAS_PROJECT.md:205-211`, mirrored in `frontend/shared/constants/index.ts:26` `FREQUENCY_RECOMMENDATIONS`) for those two fields.
- Nothing today enforces "profile must be complete before generating a calendar" at the API layer — `profile_service.get_status()` exists and is the correct existing seam (`GET /api/profile/status`) to gate `POST /api/calendar/generate`, mirroring how `frontend/proxy.ts` originally intended to gate `/chat`.
- `CalendarState.profile: dict` in `shared_state.py:27` already anticipates passing the resolved `CreatorProfile` (as a dict) into the graph — the exact shape of that dict is undefined and should be a proposal decision (raw ORM `__dict__`? a `ProfileResponse.model_dump()`? a narrowed subset?).

## Architecture Options — Calendar Generation Agent

1. **Single-shot LLM generation (one Groq call, structured output)**
   - Build one prompt with profile fields + frequency/period/formats params (+ optionally top-k RAG snippets fetched once beforehand), ask the LLM to return a JSON array of entries, parse with Pydantic/`with_structured_output`.
   - Pros: simplest to implement and test; fewest failure points; cheap (single Groq call, Llama 3.1 8B is fast); easy to unit-test with a mocked LLM response.
   - Cons: no per-node retry/repair if the model produces an invalid distribution (repeated formats, wrong day count); harder to interleave RAG retrieval per-idea; a single large JSON response from an 8B model is more failure-prone than several small calls.
   - Effort: Low.

2. **Multi-node LangGraph: `receive_params → analyze_profile → query_rag → generate_ideas → optimize_distribution → format_calendar`** (the roadmap's own design, `CONTENTSPARK_SAAS_ROADMAP.md:238-246`, matching `CalendarState`)
   - Each node is a small, testable function; `optimize_distribution` can be a deterministic Python post-processing step (no repeated formats/dates) rather than another LLM call, reducing hallucination risk on the constraint-heavy part.
   - Mirrors the existing `crag_agent.py` node/`StateGraph` style (though note `crag_agent.py` itself is still a stub — the *active* CRAG graph lives in `rag_service.py:207-224`, not `crag_agent.py`; the calendar agent has a choice of which file convention to actually follow).
   - Pros: matches project roadmap exactly; isolates LLM idea-generation from deterministic scheduling logic (easier correctness guarantees on "no repeated formats consecutively", "respect frequency count"); natural place to fetch RAG context once for the whole plan.
   - Cons: more moving parts to test than a single call; LangGraph nodes need explicit state-passing discipline; multiple LLM calls (if `generate_ideas` runs per-day or per-week) increase latency/cost.
   - Effort: Medium.

3. **Multi-node LangGraph with per-idea RAG retrieval** (query RAG once per generated entry/topic, not once globally)
   - Pros: more targeted knowledge-base grounding per content idea (closer to how CRAG grounds per-question).
   - Cons: N Qdrant calls instead of 1, meaningfully slower for a week/month calendar (up to 30 entries); the RAG corpus is generic creator-content advice (hooks, algorithms, monetization) rather than day-by-day topic material, so per-idea retrieval has a weak marginal benefit over one broader profile+niche query.
   - Effort: High.

**On structured output enforcement**: `backend/app/services/llm_services.py:21-25` uses `ChatGroq` directly with no `with_structured_output` usage anywhere in the codebase today — this would be new. `llama-3.1-8b-instant` on Groq supports tool-calling-based structured output via LangChain's `with_structured_output(PydanticModel)`. This is the natural mechanism for `generate_ideas` regardless of which option is chosen, and avoids hand-rolled JSON parsing/repair.

**Recommendation**: Option 2 (multi-node graph matching the roadmap), with `optimize_distribution` implemented as deterministic Python (not an LLM call) and a single RAG query per generation request (not per-entry) feeding `analyze_profile`/`generate_ideas`. This satisfies the roadmap's explicit spec, keeps the LLM surface small and testable (one structured-output call), and avoids the N-query latency of option 3. It also gives `sdd-design` a natural place to define the exact `CalendarState` dict shapes.

## Persistence & Regeneration Semantics — Options

`ContentCalendar.status` is currently a free `String(20)` with three implied values from the roadmap doc (`draft`, `confirmed`, `synced`) and `ContentEntry.status` has four (`idea`, `drafted`, `recorded`, `published`) — neither is a DB enum, both are comment-documented conventions only (`backend/app/models/calendar.py:28-30,68-70`).

1. **Regenerate replaces the whole calendar** (delete all entries, regenerate, same `ContentCalendar` row) — simplest, but destroys user edits made since the last confirm, and destroys `google_calendar_event_id` links once Fase 4 exists.
2. **Regenerate always creates a new `ContentCalendar` row** (never mutates an existing one in place) — safest for auditability and undo, but multiplies rows per user quickly (`GET /api/calendars` needs pagination/filtering) and the roadmap's `DELETE /api/calendars/{id}` endpoint becomes the cleanup mechanism.
3. **Immutable-once-confirmed**: `draft` calendars can be freely regenerated/overwritten in place; once `status` transitions to `confirmed` (or `synced`), regeneration is blocked or forced to create a new calendar. Individual entries stay editable (`PUT /api/calendars/{id}/entries/{entry_id}`, already specified in the roadmap) regardless of calendar status.

**Recommendation**: Option 3. It matches the roadmap's endpoint list exactly (`POST .../generate`, `.../confirm`, `PUT .../entries/{entry_id}`, `DELETE`) and creates the correct precondition for Fase 4: n8n/Google Calendar sync should never be silently invalidated by a regeneration after `confirmed`. This needs an explicit status-transition rule to be written into `sdd-propose`/`sdd-design` (what exactly triggers `confirmed → synced`? — likely Fase 4's webhook callback via `backend/app/routers/webhooks.py`, currently unexamined and out of scope here).

## Open Questions for the User (before `sdd-propose`)

1. Should `POST /api/calendar/generate` **require** `GET /api/profile/status → is_complete: true`, matching the deleted-then-restored onboarding gate pattern? If yes, `frontend/proxy.ts:70`'s `allowWithoutOnboarding` bypass for `/calendar` needs to be reconciled or explicitly kept as "page loads, but generation is blocked until profile is complete" (soft gate) rather than a route-level redirect.
2. Exact shape of `CalendarState.profile: dict` (`shared_state.py:27`) — full ORM dump, or a narrowed subset limited to the six roadmap-named fields (nicho, sub_nicho, objetivo, tono, audiencia, frecuencia)?
3. Does `POST /api/calendar/generate` stream (roadmap says "streaming", `CONTENTSPARK_SAAS_ROADMAP.md:249`) or return once complete? Streaming a structured JSON array token-by-token is harder to parse than the CRAG text-streaming case (`rag_service.py:270-275`) — likely needs a different UX (progress events per entry, not raw token stream).
4. `CalendarGenerateRequest.period` and `.formats` (`schemas/calendar.py:7-10`) are untyped (`str`, `dict | None`) — should these become closed enums/literals matching `FORMATS`/`PLATFORMS` in `frontend/shared/constants/index.ts`, mirroring how the onboarding-profile change tightened `current_frequency`/`desired_frequency` types?
5. Should calendar generation block on the Qdrant boot blocker being fixed first, or should the RAG-context node degrade gracefully (empty `rag_context`) if Qdrant is unreachable, similar to CRAG's web-search fallback (`rag_service.py:162-167`)?
6. Confirm regeneration semantics (Option 3 above) and the `confirmed → synced` trigger boundary with Fase 4 before locking `design.md`.

## Risks

- **Qdrant boot blocker** (`qdrant_services.py:37`) — already documented as blocking manual smoke-testing of the profile change; blocks it identically here for any node that queries RAG, and is worse because a calendar-generation request is far more likely to hit that path than average chat traffic.
- **Route guard drift**: `/calendar` is currently reachable with an empty profile (`proxy.ts:70`) while the entire premise of this change is "the calendar consumes the profile" — if left unresolved, a user can trigger generation with an empty profile and get generic/garbage output.
- **`CalendarState` shape is a stub, not a contract** — three different files (`shared_state.py`, `calendar_agent.py` comment-header, `schemas/calendar.py`) each imply a slightly different set of fields/types (e.g. `formats: dict` in state vs. `formats: dict | None` in the request schema vs. `preferred_formats: list[str]` in profile) — must be unified in `sdd-design`, not left to `sdd-apply` improvisation.
- **No structured-output precedent in the codebase** — `with_structured_output` on Groq/Llama-3.1-8B is new territory here; needs a small spike/prototype or explicit fallback (regex/JSON-repair) if the model doesn't reliably honor the schema.
- **400-line budget risk is High** — this change touches backend agent + service + router + schemas + tests, AND frontend service/hook/store + wiring 7 existing mocked components to real data — comparable in size to (likely larger than) the archived onboarding-profile change, which forecast 1000-1500 lines and was split into 3 delivery slices.

## Out of Scope (explicit)

- Google Calendar sync and the n8n webhook workflows (Fase 4, `backend/app/routers/webhooks.py`) — the only in-scope boundary here is that `ContentEntry.google_calendar_event_id` and `ContentCalendar.status = "synced"` exist as fields/values for Fase 4 to write into later; this change does not implement the write path.
- Fixing the Qdrant boot blocker itself (pre-existing, cross-cutting, documented in the archived onboarding-profile proposal as out of scope there too) — this change should decide how to *degrade gracefully* around it, not fix it.
- Rebuilding `crag_agent.py`/migrating the live CRAG graph out of `rag_service.py` — unrelated pre-existing stub, not touched by this change.
- General `/calendar` route guard rework beyond the specific completion-gate question in Open Question 1.

## Ready for Proposal

Yes, with the six open questions above surfaced to the user first — particularly #1 (profile-completion gate) and #6 (regeneration semantics), since both are architecture-shaping decisions that `sdd-propose`/`sdd-design` would otherwise have to guess at.
