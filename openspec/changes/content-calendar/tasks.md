# Tasks: Content Calendar Generation

STRICT TDD is active. Every implementation task is preceded by its RED test
task. Both suites must stay green throughout
(`mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test`).
Units are delivered **sequentially, straight to `main`** — no chained PRs, no
feature branches, matching the archived onboarding-profile convention
(`openspec/changes/archive/2026-08-02-onboarding-profile/tasks.md:1-6`).

Verified before writing this list (do not re-derive):
- `backend/app/models/calendar.py` already matches the target schema exactly
  — no Alembic migration in this change or any task below.
- `backend/app/agents/calendar_agent.py` (comment-only stub) and
  `backend/app/routers/calendar.py` (comment-only stub) are being replaced,
  not extended.
- `backend/main.py` does not import or register `calendar` — Unit 5 adds
  both.
- `backend/tests/conftest.py:44-49`'s `sys.modules` stubbing pattern already
  covers `llm_services`/`embeddings_service`/`qdrant_services` at import
  time, so registering `calendar.router` does not reintroduce the Qdrant
  boot blocker for tests.
- `frontend/features/calendar/` components render only hardcoded sample data
  today (`sampleCards`, `events`, fixed "Octubre 2024") with every
  actionable control `disabled`.
- Design flags Units 2, 3, 4, 8, 11 as HIGH budget risk (>400 lines including
  tests) — each is split below into lettered RED/GREEN sub-phases
  (`design.md:616-628`).
- `with_structured_output` on Groq/Llama-3.1-8B (`llm_services.py:21-25`) has
  no prior usage in this codebase (`proposal.md:236-237`, Risk table
  `proposal.md:312`) — Phase 0 below is a dedicated spike so a failure there
  is discovered before Units 3/4 are built on top of an assumed-working
  contract.

---

## Phase 0 — Spike: `with_structured_output` on Groq/Llama-3.1-8B

No dependency. Produces no committed diff to `backend/app/`; its only
deliverable is a documented finding that gates how Unit 4's fallback ladder
is built. This is deliberately **not** RED/GREEN — it is a throwaway
investigation, run and discarded, not a unit of shipped behavior.

### 0.1 Structured-output feasibility spike
- [ ] **0.1.1** [SPIKE] In a scratch script (not committed — e.g.
  `/private/tmp/.../spike_structured_output.py`, run via
  `mamba run -n contentspark python`), call
  `llm_service.llm.with_structured_output(GeneratedIdeasList)` (using the
  exact `GeneratedIdea`/`GeneratedIdeasList` Pydantic shape from
  `design.md:345-354`) against the real Groq Llama-3.1-8B endpoint with a
  realistic calendar-generation prompt (profile + resolved frequency/formats
  + empty `rag_context`). Record: (a) does the model reliably return a
  schema-conformant object on the first call, (b) what exception type/message
  a malformed response raises (`OutputParserException` vs. a LangChain
  validation error vs. something else), (c) does a repair-prompt retry (raw
  error text + restated count/format instructions) recover on a forced
  failure case (e.g. a deliberately malformed follow-up prompt).
  Spec: content-calendar-generation / Structured Idea Generation.
- [ ] **0.1.2** [SPIKE] Save the finding to Engram (`mem_save`, type
  `discovery`) recording the exact exception type(s) observed and whether the
  4-tier fallback ladder (happy path → repair retry → template pad → truncate
  overcount, `design.md:363-388`) is sufficient as designed, or whether Unit
  4's GREEN task needs to catch a broader/narrower exception set than
  `design.md` assumed. This finding is a required input to Unit 4's GREEN
  task (4b.2) — do not start 4b until this is recorded.

---

## Phase 1 — Backend: schema tightening + `CalendarState` (Unit 1)

Delivers independently: tightened Pydantic schemas and the finalized
`CalendarState` contract, with no behavioral surface yet (no router, no
service, no agent wired to them). ~110 lines. Low budget risk.

### 1.1 `CalendarState` contract
- [ ] **1.1.1** [RED] Add failing tests to a new
  `backend/tests/test_calendar_agent.py` asserting `CalendarState` (imported
  from `backend/app/agents/shared_state.py`) accepts a dict literal with
  every field from `design.md:72-88` (`user_id`, `profile`, `calendar_id`,
  `period`, `start_date`, `end_date`, `frequency`, `formats`, `rag_context`,
  `raw_ideas`, `calendar_entries`, `is_optimized`) — a static
  `typing.get_type_hints(CalendarState)` assertion covering the full field
  set, since `TypedDict` has no runtime validation to exercise directly.
  Spec: content-calendar-generation (contract underlying every requirement).
- [ ] **1.1.2** [GREEN] Edit `backend/app/agents/shared_state.py`: add
  `from typing import Literal` to the existing `Any, TypedDict` import;
  replace lines 25-34 with the full `CalendarState` TypedDict per
  `design.md:70-88`. Run 1.1.1 to green.

### 1.2 Schema tightening
- [ ] **1.2.1** [RED] Add failing tests to a new
  `backend/tests/test_calendar_schemas.py` for: `CalendarGenerateRequest`
  accepts `period` alone (frequency/formats optional), rejects an invalid
  `period` literal, rejects a `formats` key outside the closed
  `FormatLiteral` set, accepts an optional `calendar_id`; `EntryUpdate`
  accepts a partial subset of fields and rejects an out-of-set `status`;
  `EntryResponse`/`CalendarResponse`/`CalendarDetailResponse` serialize from
  a `SimpleNamespace` stand-in via `from_attributes=True`; `CalendarStatusError`
  serializes `{detail, missing_fields}`.
  Spec: content-calendar-api / Calendar Generation Endpoint (422 case),
  Entry Editing Independent of Calendar Status (422 case).
- [ ] **1.2.2** [GREEN] Replace `backend/app/schemas/calendar.py` with the
  full schema set from `design.md:391-446`
  (`FormatLiteral`, `PlatformLiteral`, `PeriodLiteral`, `EntryStatusLiteral`,
  `CalendarGenerateRequest`, `EntryUpdate`, `EntryResponse`,
  `CalendarResponse`, `CalendarDetailResponse`, `CalendarStatusError`). Run
  1.2.1 to green.

**Phase 1 exit criteria**: `pytest backend/tests` green; no router/service/
agent code touched yet; no file under `backend/alembic/versions/` added.

---

## Phase 2 — Backend: `calendar_service.py` (Unit 2)

Depends on Phase 1 (schemas, `CalendarState`). Delivers independently: a
fully tested CRUD/soft-gate/transition-guard service layer, callable in
isolation via direct service tests (no router yet). Split into 2a
(CRUD/soft-gate skeleton) and 2b (transition guards + `generate_calendar`
orchestration) per the design's HIGH-risk flag.

### 2a — CRUD skeleton, `_narrow_profile`, soft gate
- [ ] **2a.1** [RED] Create `backend/tests/test_calendar_service.py` with
  failing tests (direct service calls, `mock_db_session`-style fakes,
  mirroring `test_profile_service.py`'s SimpleNamespace approach) for:
  `_narrow_profile(profile)` returns exactly the 7-key dict from
  `design.md:127-138`; `list_calendars`/`get_calendar` scope queries by
  `user_id` (assert the constructed query/filter, or assert a not-owned
  calendar raises `404` against a fake session); `generate_calendar` raises
  `HTTPException(409, ...)` with `CalendarStatusError`-shaped detail when
  `profile_service.get_status()` returns `is_complete: False`, and does so
  **before** any agent invocation (assert the mocked `calendar_app.ainvoke`
  is never awaited).
  Spec: content-calendar-generation / Profile Completion Soft Gate;
  content-calendar-api / Authentication and Ownership Scoping (list/detail
  scoping), Calendar List and Detail Retrieval.
- [ ] **2a.2** [GREEN] Create `backend/app/services/calendar_service.py`:
  `_narrow_profile(profile) -> dict` (`design.md:127-138`); `class
  CalendarService` with `list_calendars`, `get_calendar` (`404` when not
  found/not owned, `selectinload(ContentCalendar.entries)` for detail);
  the soft-gate precondition inside `generate_calendar` (steps 1 only —
  `profile_service.get_status()` check and the `409` raise), stubbing the
  rest of `generate_calendar`'s body to be completed in 2b. Module-level
  singleton `calendar_service = CalendarService()`. Run 2a.1 to green.

### 2b — Status-transition guards + full `generate_calendar`/`confirm`/`delete`
- [ ] **2b.1** [RED] Extend `backend/tests/test_calendar_service.py` with
  failing tests for: `generate_calendar` with no `calendar_id` creates a new
  `ContentCalendar(status="draft")` and invokes `calendar_app.ainvoke` with a
  `CalendarState` built from `_narrow_profile`; `generate_calendar` with a
  `calendar_id` targeting a `draft` calendar reuses that row and replaces its
  entries (delete-then-insert); `calendar_id` targeting a non-`draft`
  calendar raises `409`; `calendar_id` targeting another user's calendar
  raises `404`; `confirm_calendar` transitions `draft → confirmed` and raises
  `409` on a second call; `delete_calendar` succeeds on `draft`/`confirmed`
  and raises `409` on `synced`; `update_entry` succeeds regardless of the
  parent calendar's status and raises `404` for an entry not belonging to the
  given calendar.
  Spec: content-calendar-api / Calendar Generation Endpoint (all
  `calendar_id` scenarios), Calendar Status Lifecycle, Entry Editing
  Independent of Calendar Status, Calendar Deletion Rules.
- [ ] **2b.2** [GREEN] Complete `calendar_service.py`: finish
  `generate_calendar`'s steps 2-5 exactly per `design.md:483-496` (load-or-
  create target calendar, narrow profile, `ainvoke` the graph, delete-then-
  insert `ContentEntry` rows, update `start_date`/`end_date`/`frequency`,
  `flush()` + `refresh()` with `entries` eager-loaded); add `update_entry`,
  `confirm_calendar`, `delete_calendar` with the guards above. Every method
  filters by `user_id` at the query level, mirroring
  `profile_service.py`'s `_to_uuid` + `select(...).where(...)` convention.
  Run 2b.1 to green. Run full backend suite — must stay green.

**Phase 2 exit criteria**: `calendar_service.py` fully covers
`design.md`'s §8 signatures; `pytest backend/tests` green; no router changes
yet.

---

## Phase 3 — Backend: `calendar_agent.py` deterministic nodes (Unit 3)

Depends on Phase 1 (`CalendarState`). Independent of Phase 2 (the agent
never queries the DB directly). Split into 3a (`receive_params`/
`analyze_profile` + period/frequency/format helpers) and 3b
(`optimize_distribution`/`format_calendar` + their algorithms), per the
design's HIGH-risk flag.

### 3a — `receive_params`, `analyze_profile`, period/frequency/format helpers
- [ ] **3a.1** [RED] Extend `backend/tests/test_calendar_agent.py` with
  failing tests for: `_resolve_period` for all 3 `PeriodLiteral` values,
  including month-boundary correctness, using a `monkeypatch`d
  `date.today()`; `_entry_count(frequency, start, end)` for
  `current_week`/`next_week` (`weeks == 1.0`, exact match) and `month`
  (`weeks ≈ 4.0-4.4`); `_distribute(entry_count, weights)` sums to
  `entry_count` exactly via largest-remainder rounding, including the
  remainder-distribution edge case; `receive_params` initializes
  `rag_context=""`, `raw_ideas=[]`, `calendar_entries=[]`,
  `is_optimized=False` and computes `start_date`/`end_date`; `analyze_profile`
  resolves `frequency` per the explicit→niche-table fallback and never
  parses `profile.desired_frequency`; `analyze_profile` resolves `formats`
  per the explicit→preferred_formats→default-mix fallback order.
  Spec: content-calendar-generation / Frequency Resolution with Niche
  Fallback (including the "never parsed" scenario), Format Resolution with
  Profile and Default Fallback.
- [ ] **3a.2** [GREEN] Rewrite `backend/app/agents/calendar_agent.py`'s
  header/module scaffolding: `FREQUENCY_RECOMMENDATIONS`,
  `DEFAULT_FORMAT_MIX`, `DEFAULT_FREQUENCY = 4` module constants;
  `_resolve_period` (`design.md:218-231`), `_entry_count`
  (`design.md:236-240`), `_distribute` (`design.md:251-259`);
  `receive_params(state) -> dict` and `analyze_profile(state) -> dict` node
  functions per `design.md` §4's behavior description (never raises —
  `analyze_profile` falls back to `DEFAULT_FREQUENCY` on an unrecognized
  niche rather than `KeyError`). Do not yet wire the `StateGraph` itself
  (deferred to 4b, once all 6 nodes exist). Run 3a.1 to green.

### 3b — `optimize_distribution`, `format_calendar`
- [ ] **3b.1** [RED] Extend `backend/tests/test_calendar_agent.py` with
  failing tests for: `optimize_distribution` produces no two adjacent
  entries with the same `format` on a balanced input; degrades to the
  minimum number of forced adjacent repeats (not a raise) when one format's
  count exceeds `ceil(n/2)`; sets `is_optimized = True` unconditionally,
  including the degraded case; `format_calendar` assigns every entry a
  `date` within `[start_date, end_date]` inclusive, cycles `TIME_SLOTS`
  correctly, and advances to the next free day on a collision, capped at
  `end_date` (the `frequency=14` / `current_week` stacking case from
  `design.md:328-333`); guards `entry_count >= 1` for a degenerate 1-day
  period.
  Spec: content-calendar-generation / Deterministic Distribution Constraints
  (both scenarios), Entries Scheduled Within the Requested Period.
- [ ] **3b.2** [GREEN] Add `optimize_distribution(raw_ideas) -> list[dict]`
  (`design.md:276-296`, the `Counter`/`deque` max-count-first greedy) and
  `format_calendar(ordered_ideas, start_date, end_date) -> list[dict]`
  (`design.md:308-327`, `TIME_SLOTS = ["morning", "afternoon", "evening"]`)
  to `calendar_agent.py` as standalone functions, not yet as graph node
  wrappers (the `StateGraph`-facing `optimize_distribution(state)`/
  `format_calendar(state)` node signatures are added in 4b once all 6 nodes
  are ready to wire together). Run 3b.1 to green. Run full backend suite —
  must stay green.

**Phase 3 exit criteria**: all 4 deterministic nodes' logic and their 3
shared helpers exist and are independently unit-tested with no LLM/DB/Qdrant
dependency; `pytest backend/tests` green.

---

## Phase 4 — Backend: `query_rag` + `generate_ideas` (Unit 4)

Depends on Phase 3 (node functions to assemble the graph around) and Phase 0
(spike finding). Split into 4a (`query_rag` + happy-path `generate_ideas`)
and 4b (the repair/template fallback ladder + full `StateGraph` assembly),
per the design's HIGH-risk flag — the fallback ladder is explicitly called
out as "the single largest node" (`design.md:621`).

### 4a — `query_rag` + happy-path `generate_ideas`
- [ ] **4a.1** [RED] Extend `backend/tests/test_calendar_agent.py` with
  failing tests for: `query_rag` calls
  `qdrant_search_service.search_similar(query, top_k=4)` grounded on
  `f"{profile['niche']} {profile['sub_niche'] or ''}"` exactly once;
  `query_rag` sets `rag_context = ""` (not `None`, does not raise) when
  `search_similar` is `monkeypatch`d to raise; `generate_ideas` happy path —
  `monkeypatch` `llm_service.llm.with_structured_output` to return a fake
  structured-llm whose `.ainvoke` is an `AsyncMock` returning a
  `GeneratedIdeasList` with exactly `sum(formats.values())` conformant
  `GeneratedIdea` items — asserts `raw_ideas` matches those items
  unmodified.
  Spec: content-calendar-generation / RAG Context Degrades Gracefully (all 3
  scenarios), Structured Idea Generation.
- [ ] **4a.2** [GREEN] Add to `calendar_agent.py`: `GeneratedIdea`,
  `GeneratedIdeasList` Pydantic models and `FormatLiteral`/`PlatformLiteral`
  (`design.md:342-354`); `query_rag(state) -> dict` (try/except around the
  single `search_similar` call, `design.md`'s `query_rag` behavior); the
  happy-path branch of `generate_ideas(state) -> dict`
  (`with_structured_output(GeneratedIdeasList)` call, tier 1 of the fallback
  ladder only). Run 4a.1 to green.

### 4b — Repair/template fallback ladder + `StateGraph` assembly
- [ ] **4b.1** [RED] Extend `backend/tests/test_calendar_agent.py` with
  failing tests, each `monkeypatch`ing `.ainvoke` with a scripted
  `AsyncMock` `side_effect` list, for `generate_ideas`'s remaining 3 fallback
  tiers: schema/tool-call failure on the first call followed by a
  successful repair-prompt retry; repair retry also fails (or returns fewer
  ideas than `sum(formats.values())`) → deterministic template padding via
  `_template_idea(fmt, profile, index)` (`design.md:374-382`), asserting the
  node never raises; `len(result.ideas) > sum(formats.values())` → truncated
  to the target count, preserving order. Add one graph-assembly test:
  `calendar_app` (the compiled `StateGraph`) runs all 6 nodes in order given
  a fully mocked LLM/Qdrant, producing a `CalendarState` with
  `is_optimized=True` and `len(calendar_entries) == sum(formats.values())`.
  Spec: content-calendar-generation / Structured Idea Generation (schema
  conformance under fallback), Deterministic Distribution Constraints (entry
  count still matches after fallback).
- [ ] **4b.2** [GREEN] Complete `generate_ideas`'s tiers 2-4 exactly per
  `design.md:363-388`, applying Phase 0's spike finding for the exact
  exception type(s) to catch on the repair-retry path (do not guess a
  broader/narrower except-clause than the spike recorded);
  `DEFAULT_PLATFORM_BY_FORMAT` module constant backing `_template_idea`.
  Assemble the `StateGraph` (`receive_params → analyze_profile → query_rag →
  generate_ideas → optimize_distribution → format_calendar`), compile it as
  `calendar_app`, wrapping the standalone `optimize_distribution`/
  `format_calendar` functions from 3b as thin `(state) -> dict` node
  wrappers. Run 4b.1 to green. Run full backend suite — must stay green.

**Phase 4 exit criteria**: `calendar_app` is a fully assembled, fully mocked-
LLM-tested `StateGraph`; `generate_ideas` never raises under any of the 4
observed/tested failure modes; `pytest backend/tests` green.

---

## Phase 5 — Backend: `routers/calendar.py` + `main.py` registration (Unit 5)

Depends on Phase 2 (service) and Phase 4 (`calendar_app`, consumed by the
service, not the router directly). Delivers independently: the full HTTP
surface, closing out the backend half of this change. ~220 lines, Med risk
— not split further.

### 5.1 Router tests
- [ ] **5.1.1** [RED] Extend `backend/tests/test_calendar.py` (currently a
  2-line stub) with failing tests via the `client` fixture and a new
  `patch_calendar_service` fixture (added in 5.2 alongside, mirroring
  `patch_profile_service`): one 401-without-token test per of the 6
  endpoints; `POST /api/calendar/generate` → `200` happy path, `409` with
  `{detail, missing_fields}` body on soft-gate failure, `404`/`409` for the
  two `calendar_id` failure modes, `422` for an invalid body; `GET
  /api/calendars` → `200` list, caller-scoped; `GET /api/calendars/{id}` →
  `200` detail, `404` unknown; `PUT
  /api/calendars/{id}/entries/{entry_id}` → `200`, `404`, `422`; `POST
  /api/calendars/{id}/confirm` → `200`, `404`, `409`; `DELETE
  /api/calendars/{id}` → `204`, `404`, `409` on `synced`.
  Spec: content-calendar-api / all requirements (Authentication and
  Ownership Scoping, Calendar Generation Endpoint, Calendar List and Detail
  Retrieval, Calendar Status Lifecycle, Entry Editing Independent of
  Calendar Status, Calendar Deletion Rules).
- [ ] **5.1.2** [GREEN]
  - Add `patch_calendar_service` fixture to `backend/tests/conftest.py`,
    mirroring `patch_profile_service`: `AsyncMock` for `generate_calendar`,
    `list_calendars`, `get_calendar`, `update_entry`, `confirm_calendar`,
    `delete_calendar`.
  - Replace the 2-line stub in `backend/app/routers/calendar.py` with
    `APIRouter(prefix="/api", tags=["calendar"])` and 6 thin handlers per
    `proposal.md`'s API table (`proposal.md:180-187`), each using
    `Depends(get_current_user)` / `Depends(get_db)`.
  - Edit `backend/main.py`: add `calendar` to the router import line and
    `app.include_router(calendar.router)` after `profile.router`
    (`design.md:501-504`).
  Run 5.1.1 to green. Run full backend suite — must stay green.
- [ ] **5.1.3** [VERIFY] `ruff check backend/` reports no new findings on
  touched/created files (`routers/calendar.py`, `main.py`, `conftest.py`,
  `test_calendar.py`, and every file touched in Phases 0-4). Pre-existing
  findings are untouched debt — do not fix them here.

**Phase 5 exit criteria (backend delivery complete)**: full 6-endpoint
surface tested end to end; `pytest backend/tests` green; `ruff check
backend/` clean on new files; no file under `backend/alembic/versions/`
added.

---

## Phase 6 — Frontend: `calendar-api.ts` data layer (Unit 6)

Depends on Phase 5 (contract frozen). Delivers independently: a tested API
client with no store/UI wired to it yet. ~150 lines, Low risk.

### 6.1 `calendar-api.ts`
- [ ] **6.1.1** [RED] Create
  `frontend/features/calendar/services/calendar-api.test.ts` with failing
  tests (mirror `profile-api.test.ts`'s `vi.spyOn`/mocked-`fetch` pattern):
  `getCalendars()` calls `GET /api/calendars`; `getCalendar(id)` calls `GET
  /api/calendars/{id}`; `generateCalendar(input)` calls `POST
  /api/calendar/generate` with the given body; `updateEntry(calendarId,
  entryId, partial)` calls `PUT .../entries/{entryId}`; `confirmCalendar(id)`
  calls `POST .../confirm`; `deleteCalendar(id)` calls `DELETE`; each throws
  `ApiError` on non-ok response; `generateCalendar`'s `409` response surfaces
  `missing_fields` on the thrown `ApiError` (assert
  `error.status === 409` and the parsed body shape), distinctly from a
  generic error.
  Spec: content-calendar-ui / Generation Configuration Control (client
  contract), Empty State with Onboarding CTA (409-surfacing scenario).
- [ ] **6.1.2** [GREEN] Create
  `frontend/features/calendar/services/calendar-api.ts` mirroring
  `profile-api.ts`: `apiFetch` + local `ensureOk`, the 6 functions and 5 TS
  interfaces from `design.md:508-530`
  (`EntryItem`, `CalendarItem`, `CalendarDetail`, `GenerateInput`,
  `EntryUpdateInput`). Run 6.1.1 to green.

**Phase 6 exit criteria**: `pnpm --dir frontend test` green; no store/
component consumes `calendar-api.ts` yet.

---

## Phase 7 — Frontend: `calendarStore.ts` + generation hook (Unit 7)

Depends on Phase 6. Delivers independently: application state, still with
no components wired to it. ~160 lines, Med risk.

### 7.1 `calendarStore.ts`
- [ ] **7.1.1** [RED] Create
  `frontend/features/calendar/store/calendarStore.test.ts` with failing
  tests (mirror `profileStore.test.ts`'s `vi.spyOn` + `getState()` pattern):
  `loadCalendars()` sets `isLoading` true→false, populates `calendars`;
  `loadCalendar(id)` populates `currentCalendar`; `generate(input)` sets
  `isGenerating` true→false and populates `currentCalendar` on success, sets
  `error` (not a crash) on a `409` `ApiError`; `updateEntry`/`confirm`/
  `remove` call the corresponding api function and update local state on
  success; `setViewMode` toggles `viewMode` between `"month"`/`"week"`.
  Spec: content-calendar-ui / Empty State with Onboarding CTA (409 → error
  state, not crash), Real-Data Rendering Replaces Mocks (state backing).
- [ ] **7.1.2** [GREEN] Create
  `frontend/features/calendar/store/calendarStore.ts`: Zustand store with
  the shape from `design.md:538-553` (`calendars`, `currentCalendar`,
  `viewMode`, `isLoading`, `isGenerating`, `error`, and the 7 actions). Run
  7.1.1 to green.

### 7.2 `useCalendarGeneration.ts`
- [ ] **7.2.1** [RED] Create
  `frontend/features/calendar/hooks/useCalendarGeneration.test.tsx` with
  failing tests: local draft state for `period`/`frequency`/`formats` before
  submit; submit calls `calendarStore.generate` with the assembled
  `GenerateInput`, omitting `frequency`/`formats` when left unset (so the
  server-side fallback path is reachable, per
  content-calendar-ui / Generation Configuration Control's "period only"
  scenario).
  Spec: content-calendar-ui / Generation Configuration Control (both
  scenarios).
- [ ] **7.2.2** [GREEN] Create
  `frontend/features/calendar/hooks/useCalendarGeneration.ts`: local
  `useState` draft object (mirrors `useOnboardingWizard.ts`'s draft-state
  pattern, `design.md:556-560`), wrapping `calendarStore.generate`. Run
  7.2.1 to green. Run full frontend suite — must stay green.

**Phase 7 exit criteria**: `pnpm --dir frontend test` green; store and hook
fully tested; no page component wired yet.

---

## Phase 8 — Frontend: wire `TimelineCards`/`CalendarGrid` to real data (Unit 8)

Depends on Phase 7. Split into 8a (`TimelineCards`) and 8b (`CalendarGrid`,
"the harder date-math component", `design.md:625`), per the design's
HIGH-risk flag.

### 8a — `TimelineCards.tsx`
- [ ] **8a.1** [RED] Create/extend
  `frontend/features/calendar/components/TimelineCards.test.tsx` with
  failing tests (`@testing-library/react`, mocked `calendarStore` state):
  renders exactly `currentCalendar.entries` filtered to the next 48h, no
  `sampleCards` array present in the rendered output or the source; the "more
  options" (`⋮`) button opens the entry-edit affordance for that entry
  (asserted via a callback/prop spy, since `EntryEditModal` itself is built
  in Phase 10 — stub the trigger as a prop callback here, wire the real
  modal in 10.2).
  Spec: content-calendar-ui / Real-Data Rendering Replaces Mocks (timeline
  scenario).
- [ ] **8a.2** [GREEN] Edit
  `frontend/features/calendar/components/TimelineCards.tsx`: remove
  `sampleCards`, render `currentCalendar.entries` filtered to the next 48h
  via `calendarStore`, wire the `⋮` button to an `onEditEntry(entryId)` prop
  callback. Pagination arrows stay `disabled` (unrelated, out of scope). Run
  8a.1 to green.

### 8b — `CalendarGrid.tsx`
- [ ] **8b.1** [RED] Create/extend
  `frontend/features/calendar/components/CalendarGrid.test.tsx` with
  failing tests: no hardcoded `events`/`"Octubre 2024"`/`FIRST_DAY_OFFSET`
  remain; grid derives its displayed dates from
  `currentCalendar.start_date`/`end_date`; `viewMode === "month"` renders
  the full month grid anchored on the actual current month (not a fixed
  one); `viewMode === "week"` renders a 7-cell row for the current/next
  week; clicking an entry chip triggers `onEditEntry(entryId)` (same
  stubbed-callback pattern as 8a).
  Spec: content-calendar-ui / Real-Data Rendering Replaces Mocks (grid
  scenario, "never a fixed hardcoded month").
- [ ] **8b.2** [GREEN] Edit
  `frontend/features/calendar/components/CalendarGrid.tsx`: remove
  `events`/hardcoded month/`FIRST_DAY_OFFSET`, derive the grid from
  `currentCalendar.start_date`/`end_date` and `calendarStore.viewMode`, wire
  entry chips to `onEditEntry(entryId)`. Run 8b.1 to green. Run full
  frontend suite — must stay green.

**Phase 8 exit criteria**: both components render only fetched data; no
hardcoded sample array or fixed date remains in either file's diff.

---

## Phase 9 — Frontend: `GenerateControl.tsx` (Unit 9)

Depends on Phase 7 (`useCalendarGeneration`). Net-new UI, ~180 lines, Med
risk — not split further.

### 9.1 `GenerateControl.tsx`
- [ ] **9.1.1** [RED] Create
  `frontend/features/calendar/components/GenerateControl.test.tsx` with
  failing tests: renders a period select (3 options), frequency input,
  per-format count inputs (or a "use recommended" toggle); submitting with
  only a period calls `generate` with `{period}` only (no `frequency`/
  `formats` keys); submitting with explicit frequency/formats includes both
  in the call; "Generar con AI" is disabled/shows a loading state while
  `isGenerating` is true.
  Spec: content-calendar-ui / Generation Configuration Control (both
  scenarios).
- [ ] **9.1.2** [GREEN] Create
  `frontend/features/calendar/components/GenerateControl.tsx`
  (glassmorphism, Inter): period select, frequency input, per-format count
  inputs, submit button calling `useCalendarGeneration`'s submit. Run 9.1.1
  to green. Run full frontend suite — must stay green.

**Phase 9 exit criteria**: a user can configure and trigger generation from
the UI in isolation (component-level, not yet composed into `CalendarView`).

---

## Phase 10 — Frontend: `EntryEditModal.tsx` (Unit 10)

Depends on Phase 6 (`updateEntry` contract) and Phase 8 (both trigger sites
exist as stubbed callbacks). Net-new UI, ~190 lines, Med risk — not split
further.

### 10.1 `EntryEditModal.tsx`
- [ ] **10.1.1** [RED] Create
  `frontend/features/calendar/components/EntryEditModal.test.tsx` with
  failing tests: renders a form for `title`/`hook`/`description`/`format`/
  `platform`/`status`/`time_slot` pre-filled from the target entry; submit
  calls `calendarStore.updateEntry(entryId, partial)` with only the changed
  fields; the modal is available/functional when the parent calendar's
  status is `"confirmed"` (not disabled).
  Spec: content-calendar-api / Entry Editing Independent of Calendar Status
  (client-side mirror); content-calendar-ui / Entry Edit Affordance (both
  scenarios).
- [ ] **10.1.2** [GREEN] Create
  `frontend/features/calendar/components/EntryEditModal.tsx`
  (glassmorphism, Inter). Run 10.1.1 to green.

### 10.2 Wire the modal into both trigger sites
- [ ] **10.2.1** [RED] Extend `TimelineCards.test.tsx` and
  `CalendarGrid.test.tsx` (from Phase 8) to assert the real
  `EntryEditModal` opens (not just the stubbed callback firing) when
  `onEditEntry` fires from each component.
- [ ] **10.2.2** [GREEN] Replace the stubbed `onEditEntry` callback wiring
  in `TimelineCards.tsx` and `CalendarGrid.tsx` with the real
  `EntryEditModal` (rendered by the parent `CalendarView.tsx`, opened via
  lifted modal-open state — modal itself is a portal/overlay per
  `design.md:577`). Run 10.2.1 to green. Run full frontend suite — must
  stay green.

**Phase 10 exit criteria**: entry editing is reachable from both the
timeline and the grid, functional regardless of calendar status.

---

## Phase 11 — Frontend: `ConfirmBar.tsx` + `CalendarEmptyState.tsx` + `proxy.ts` comment (Unit 11)

Depends on Phase 8, 9 (both compose into the same `CalendarView.tsx`
eventually assembled here). Split into 11a (`ConfirmBar`) and 11b
(`CalendarEmptyState` + `proxy.ts` comment + final `CalendarView.tsx`
composition), per the design's HIGH-risk flag.

### 11a — `ConfirmBar.tsx`
- [ ] **11a.1** [RED] Create
  `frontend/features/calendar/components/ConfirmBar.test.tsx` with failing
  tests: renders a status badge (`draft`/`confirmed`/`synced`); "Confirmar
  calendario" button calls `calendarStore.confirm`, disabled when status is
  not `draft`; delete action calls `calendarStore.remove`, disabled when
  status is `synced`.
  Spec: content-calendar-api / Calendar Status Lifecycle (confirm client
  mirror), Calendar Deletion Rules (delete-disabled-on-synced client
  mirror).
- [ ] **11a.2** [GREEN] Create
  `frontend/features/calendar/components/ConfirmBar.tsx` (glassmorphism,
  Inter). Run 11a.1 to green.

### 11b — `CalendarEmptyState.tsx` + `proxy.ts` comment + `CalendarView.tsx` composition
- [ ] **11b.1** [RED] Create
  `frontend/features/calendar/components/CalendarEmptyState.test.tsx` with
  failing tests: renders when `calendars.length === 0`; renders when the
  last `generate()` call resolved a `409`; CTA button links to
  `/onboarding`; does not attempt to call the generation endpoint
  automatically on render. Extend `CalendarView.test.tsx` (new, or folded
  into an existing calendar page test if no page-test convention exists in
  this repo — mirror the onboarding-profile precedent's folding decision)
  asserting: `CalendarView` loads `calendarStore.loadCalendars()` on mount;
  composes `GenerateControl`, `ConfirmBar`, `CalendarEmptyState`
  (conditional), and the wired `EntryEditModal`; a user with an incomplete
  profile visiting `/calendar` sees `CalendarEmptyState`, not a redirect to
  `/onboarding`.
  Spec: content-calendar-ui / Calendar Page Accessible Without a Complete
  Profile, Empty State with Onboarding CTA (all 3 scenarios).
- [ ] **11b.2** [GREEN] Create
  `frontend/features/calendar/components/CalendarEmptyState.tsx`
  (glassmorphism, Inter, CTA linking to `/onboarding`). Edit
  `frontend/features/calendar/CalendarView.tsx`: load calendars on mount,
  compose `GenerateControl`, `ConfirmBar`, `CalendarEmptyState`
  (conditional), `EntryEditModal` (portal/overlay) alongside the 7 existing
  components; `GoogleSyncButton`/`PerformancePanel`/`ActivityPanel`/
  `CreatorTip` stay unchanged/mocked. Add the inline comment (no logic
  change) at `frontend/proxy.ts:70` documenting the kept
  `allowWithoutOnboarding` bypass as the soft-gate's deliberate mechanism,
  per `design.md:579-582`. Run 11b.1 to green. Run full frontend suite —
  must stay green.

**Phase 11 exit criteria**: `/calendar` is fully composed — generation,
timeline/grid, entry editing, confirm/delete, and the soft-gate empty state
all reachable from one page; `frontend/app/(app)/layout.tsx` untouched;
`frontend/proxy.ts` diff is comment-only.

---

## Final verification (all phases)

- [ ] **F.1** Run `mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test` — both green, including every new calendar suite from Phases 1-11.
- [ ] **F.2** Run `ruff check backend/` — no new findings beyond the pre-existing documented debt.
- [ ] **F.3** Run `pnpm --dir frontend lint` and `pnpm --dir frontend exec tsc --noEmit` — clean (or no new findings beyond documented pre-existing warnings).
- [ ] **F.4** Run `pnpm --dir frontend build` — succeeds, `/calendar` route builds without error.
- [ ] **F.5** Confirm `git status backend/alembic/versions/` shows no new file.
- [ ] **F.6** Confirm `git diff frontend/app/(app)/layout.tsx` is empty.
- [ ] **F.7** Confirm `git diff frontend/proxy.ts` is comment-only (no logic change at line 70 or elsewhere).
- [ ] **F.8** Manually verify each proposal Success Criteria item
  (`proposal.md:319-343`) is covered by at least one automated test above —
  cross-check against the traceability table below; do not add new tests
  here, only confirm coverage.

---

## Review Workload Forecast

| Unit | Sub-phases | Estimated lines (carried from `design.md:616-628`) | Budget risk |
|---|---|---|---|
| 0 — Spike | 0.1 | ~0 committed (throwaway script + Engram note) | — |
| 1 — Schema + `CalendarState` | 1.1, 1.2 | ~110 | Low |
| 2 — `calendar_service.py` | 2a (~130), 2b (~130) | ~260 | **High** (split) |
| 3 — `calendar_agent.py` deterministic nodes | 3a (~130), 3b (~130) | ~260 | **High** (split) |
| 4 — `query_rag` + `generate_ideas` | 4a (~110), 4b (~130) | ~240 | **High** (split) |
| 5 — `routers/calendar.py` + `main.py` | 5.1 | ~220 | Med |
| 6 — `calendar-api.ts` | 6.1 | ~150 | Low |
| 7 — `calendarStore.ts` + hook | 7.1, 7.2 | ~160 | Med |
| 8 — `TimelineCards`/`CalendarGrid` wiring | 8a (~110), 8b (~120) | ~230 | **High** (split) |
| 9 — `GenerateControl.tsx` | 9.1 | ~180 | Med |
| 10 — `EntryEditModal.tsx` + wiring | 10.1, 10.2 | ~190 | Med |
| 11 — `ConfirmBar`/`CalendarEmptyState`/`proxy.ts` | 11a (~90), 11b (~110) | ~200 | **High** (split) |
| **Total** | | **~2200** | |

`400-line budget risk: High` at the unit level for Units 2, 3, 4, 8, 11 —
mitigated by the lettered a/b splits above, each landing at ~90-130 lines,
well under budget individually.

`Chained PRs: Not used.` Delivery is sequential single-branch straight to
`main`, per the archived onboarding-profile precedent and this change's
locked delivery convention (`design.md:653-655` resolves the proposal's open
question in favor of sequential, matching the archive).

---

## Task-to-spec traceability

| Task(s) | Spec requirement |
|---|---|
| 2a.1, 2a.2 | content-calendar-generation / Profile Completion Soft Gate |
| 3a.1, 3a.2 | content-calendar-generation / Frequency Resolution with Niche Fallback, Format Resolution with Profile and Default Fallback |
| 4a.1, 4a.2 | content-calendar-generation / RAG Context Degrades Gracefully, Structured Idea Generation |
| 4b.1, 4b.2 | content-calendar-generation / Structured Idea Generation (fallback), Deterministic Distribution Constraints (count preserved under fallback) |
| 3b.1, 3b.2 | content-calendar-generation / Deterministic Distribution Constraints, Entries Scheduled Within the Requested Period |
| 5.1 | content-calendar-api / all requirements |
| 6.1 | content-calendar-ui / Generation Configuration Control (client contract), Empty State with Onboarding CTA (409 surfacing) |
| 7.1, 7.2 | content-calendar-ui / Generation Configuration Control, Empty State with Onboarding CTA (error state) |
| 8a, 8b | content-calendar-ui / Real-Data Rendering Replaces Mocks |
| 9.1 | content-calendar-ui / Generation Configuration Control |
| 10.1, 10.2 | content-calendar-api / Entry Editing Independent of Calendar Status; content-calendar-ui / Entry Edit Affordance |
| 11a.1, 11a.2 | content-calendar-api / Calendar Status Lifecycle, Calendar Deletion Rules |
| 11b.1, 11b.2 | content-calendar-ui / Calendar Page Accessible Without a Complete Profile, Empty State with Onboarding CTA |

## Parallelization notes

- Phase 0 (spike) has no dependency and can run before or in parallel with
  Phase 1 — it only needs to complete before 4b starts.
- Phase 1's 1.1 and 1.2 can run in parallel (independent files).
- Phase 2 depends on Phase 1 only; Phase 3 depends on Phase 1 only. **Phases
  2 and 3 can run in parallel** — the agent never queries the DB and the
  service never imports agent internals beyond `calendar_app` (consumed only
  in 2b.2, after 3b/4b exist). In practice, sequence 2 before 3 if only one
  writer thread is available, since 2b's `generate_calendar` needs the fully
  assembled `calendar_app` from 4b to pass its own integration-style test —
  treat 2b.2 as blocked on 4b.2 specifically, not on all of Phase 3.
- Phase 4 (4a, 4b) depends on Phase 3 (3a, 3b) and Phase 0. Sequential
  within: 4a before 4b.
- Phase 5 depends on Phase 2 (2b) and Phase 4 (4b) — the router only calls
  into `calendar_service`, which itself calls `calendar_app`.
- Phases 6-11 are sequential frontend layers, each consuming the previous
  one's exports (6 → 7 → {8, 9} → 10 → 11), mirroring the archived change's
  service → store → components layering. 8a/8b and 9 can run in parallel
  once Phase 7 lands (independent components); 10 depends on both 6 (data
  contract) and 8 (trigger sites); 11a is independent of 11b but both must
  land before Phase 11's exit criteria (final `CalendarView.tsx`
  composition) are checked.
- No frontend task may start meaningfully before Phase 5 is merged (contract
  freeze), same rule as the archived change's Phase 1 → Phase 2 boundary.
