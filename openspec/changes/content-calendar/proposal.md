# Proposal: Content Calendar Generation

**Modules affected**: backend (FastAPI, LangGraph) **and** frontend (Next.js features).

## Intent

Fase 3 of `CONTENTSPARK_SAAS_ROADMAP.md:229-273` calls for AI-generated, editable,
confirmable content calendars — the feature the roadmap itself labels retention-driving
(`CONTENTSPARK_SAAS_ROADMAP.md:358`). Today nothing behind `/calendar` is real:
`backend/app/agents/calendar_agent.py:1-4` and `backend/app/routers/calendar.py:1-2`
are comment-only stubs, `calendar.py` is not registered in `backend/main.py`
(`exploration.md:14`, confirmed against `backend/main.py:8,36-40`), and every
component under `frontend/features/calendar/` renders hardcoded sample data with
every actionable control `disabled` (`exploration.md:21-23`). The SQLAlchemy models
(`backend/app/models/calendar.py:11-77`) and migration already exist and need no
schema change.

Success: an authenticated creator with a complete profile can request a calendar
for a period (current week / next week / month), receive an AI-generated,
niche-grounded set of entries respecting a frequency and format distribution,
edit individual entries, confirm the calendar, and see all of that in the
existing `/calendar` UI — with zero new Alembic migrations and a documented,
deliberate soft gate on profile completeness rather than a hard route block.

## Scope

### In Scope
- Tighten `backend/app/schemas/calendar.py:7-30` (`CalendarGenerateRequest`,
  `EntryUpdate`, `CalendarResponse`) and add the response schemas the roadmap's
  endpoint list requires but that do not exist yet (an entry read schema, a
  calendar-with-entries detail schema, a status/soft-gate error shape).
- Finalize `CalendarState` (`backend/app/agents/shared_state.py:25-34`) as the
  single contract shared by the agent, the service, and the schemas — resolving
  the three-way shape contradiction flagged in `exploration.md:83`.
- `backend/app/agents/calendar_agent.py` — real multi-node `StateGraph`
  (`receive_params → analyze_profile → query_rag → generate_ideas →
  optimize_distribution → format_calendar`), per the roadmap's own design
  (`CONTENTSPARK_SAAS_ROADMAP.md:238-242`).
- New `backend/app/services/calendar_service.py` (CRUD + status-gate check +
  regeneration/confirm state-transition rules), mirroring
  `backend/app/services/profile_service.py`'s shape.
- Real `backend/app/routers/calendar.py` implementing the roadmap's six
  endpoints (`CONTENTSPARK_SAAS_ROADMAP.md:249-254`), registered in
  `backend/main.py` alongside the existing `auth, chat, chats, ingest, profile`
  routers (`backend/main.py:8,36-40`).
- `backend/tests/test_calendar.py` (currently a 2-line stub,
  `exploration.md:17`) reusing the `sys.modules` stubbing pattern from
  `backend/tests/conftest.py:44-49`.
- Frontend: `frontend/features/calendar/services/calendar-api.ts`, a Zustand
  store, and a generation hook, following the `frontend/features/profile/`
  precedent (`services/*-api.ts` over `apiFetch` + store + hook).
- Wiring `TimelineCards.tsx` and `CalendarGrid.tsx` to real data (removing
  `sampleCards`/`events` and the hardcoded "Octubre 2024" — `exploration.md:22`)
  and making `CalendarGrid` date-aware for both the requested period and the
  live month/week toggle already in `TopBar.tsx:6`.
- **New** frontend UI the roadmap specifies but that does not exist in any
  mocked component today (see "Frontend gap" below): a frequency/period/format
  generation control, and an entry-edit affordance (modal or inline form)
  wired to `PUT /api/calendars/{id}/entries/{entry_id}`.
- A `/calendar` empty state shown when `GET /api/profile/status` (or the
  calendar list itself) indicates no usable profile/calendar, with a CTA to
  `/onboarding` — this is the soft-gate's UI half.
- Explicit documentation (this proposal + inline comment) of why
  `frontend/proxy.ts:70`'s `allowWithoutOnboarding` exemption for `/calendar`
  is being kept, not silently left as drift.

### Out of Scope
- Google Calendar sync and n8n webhook workflows (Fase 4,
  `backend/app/routers/webhooks.py`) — this change only guarantees that
  `ContentEntry.google_calendar_event_id` and `ContentCalendar.status =
  "synced"` exist as a field/value for Fase 4 to write into
  (`backend/app/models/calendar.py:28-30,71-73`). `GoogleSyncButton.tsx` stays
  `disabled`/"Próximamente" in this change.
- Fixing the Qdrant boot blocker (`backend/app/services/qdrant_services.py:37`,
  documented in the archived onboarding-profile proposal,
  `openspec/changes/archive/2026-08-02-onboarding-profile/proposal.md:154-157`).
  This change decides how the agent *degrades* around it (see Approach), not
  how to fix it.
- Migrating `crag_agent.py`/consolidating the live CRAG graph out of
  `rag_service.py:207-224` — unrelated pre-existing stub.
- General `/calendar` route-guard rework beyond keeping and documenting the
  existing `allowWithoutOnboarding` bypass. `frontend/app/(app)/layout.tsx`
  and the rest of `proxy.ts`'s redirect logic are untouched.
- Any Alembic migration — `backend/app/models/calendar.py` already matches
  the target schema exactly (`exploration.md:10-11`).
- Analytics widgets (`PerformancePanel.tsx`, `ActivityPanel.tsx`,
  `CreatorTip.tsx`) — none of the roadmap's six endpoints back them with real
  data; they stay decorative/mocked in this change (see question round below).
- Drag & drop entry rescheduling — explicitly deferred by the roadmap itself
  (`CONTENTSPARK_SAAS_ROADMAP.md:262`, "futuro").

## Capabilities

### New Capabilities
- `content-calendar-generation`: the LangGraph agent, its profile-fallback
  and RAG-degradation rules, and the generate/regenerate/confirm lifecycle.
- `content-calendar-api`: the six-endpoint CRUD/generation surface, its auth,
  ownership, and soft-gate error contract.

### Modified Capabilities
- None yet promoted under `openspec/specs/` for calendar; this change creates
  both specs fresh (mirroring how `creator-profile`/`creator-onboarding` were
  created fresh, not modified, by the archived change).

## The `CalendarState` Contract (resolving the three-way conflict)

`exploration.md:83` flags that `shared_state.py`, the `calendar_agent.py`
comment header, and `schemas/calendar.py` each imply different shapes. This
proposal fixes the single contract used by the agent internally; `sdd-design`
owns field-level typing detail, not renegotiation of these names:

| Field | Type | Source of truth |
|---|---|---|
| `user_id` | `str` | request-scoped |
| `profile` | `dict` — narrowed subset of `ProfileResponse.model_dump()`: `niche`, `sub_niche`, `primary_goal`, `tone`, `target_audience`, `desired_frequency`, `preferred_formats` | `profile_service.get_or_create_profile()` (never a raw `CreatorProfile` query — same rule as `exploration.md:31`) |
| `frequency` | `int` — **resolved**, not the raw request value | see Profile Fallback below |
| `period` | `Literal["current_week", "next_week", "month"]` | resolved from the request |
| `formats` | `dict[str, int]` — **resolved** format→count map, keys from the same closed set as `FORMATS` in `frontend/shared/constants/index.ts:18-24` | see Profile Fallback below |
| `rag_context` | `str` — empty string on Qdrant failure/empty result, never `None` | `query_rag` node |
| `calendar_entries` | `list[dict]` — one dict per generated entry, matching `ContentEntry` column names (`title`, `format`, `platform`, `hook`, `description`, `time_slot`) before persistence | `generate_ideas`/`optimize_distribution` |
| `is_optimized` | `bool` | set `True` only after `optimize_distribution` runs |

`formats: dict` (not `dict | None`) inside `CalendarState` is deliberate: the
request-level `formats: dict | None` gets resolved to a concrete map before
entering the graph, so no node has to re-implement the fallback.

### Profile Fallback (Decision 7)

Because `is_complete` only requires `niche`, `primary_goal`, `tone`,
`target_audience` (`openspec/specs/creator-profile/spec.md:67-70`),
`desired_frequency` and `preferred_formats` may be absent even on a complete
profile. Resolution order, computed once in `analyze_profile`:

- **Frequency**: `CalendarGenerateRequest.frequency` (if the caller supplied
  one) → else `FREQUENCY_RECOMMENDATIONS[profile.niche]`
  (`CONTENTSPARK_SAAS_PROJECT.md:205-211`, mirrored in
  `frontend/shared/constants/index.ts:26-33`).
  `profile.desired_frequency` is **not** used as a numeric fallback source:
  it is free text (e.g. `"3 por semana"`, per the onboarding-profile decision
  to keep frequencies as strings —
  `openspec/specs/creator-profile/spec.md:142-145`), and this proposal does
  not want the agent guessing at string parsing. See question round item 5.
- **Formats**: `CalendarGenerateRequest.formats` (if supplied) → else
  `profile.preferred_formats` (if non-empty, weighted evenly across the
  resolved `frequency`) → else a fixed default mix, defined once in
  `calendar_agent.py` and documented in `design.md` (not invented here to
  avoid over-specifying a `sdd-design` decision).

## Status Lifecycle

`ContentCalendar.status` (`backend/app/models/calendar.py:28-30`) and
`ContentEntry.status` (`:68-70`) are free `String` columns today, not DB
enums — this proposal keeps them as strings (no migration) but constrains the
values at the Pydantic/schema layer.

**`ContentCalendar.status`**: `draft → confirmed → synced`
- `draft`: created by `POST /api/calendar/generate`. May be regenerated in
  place (entries replaced, calendar row reused) as many times as needed.
- `confirmed`: set by `POST /api/calendars/{id}/confirm`. Only legal from
  `draft`; confirming an already-`confirmed`/`synced` calendar is `409`.
- `synced`: **out of scope** — written only by Fase 4's (not-yet-built)
  webhook/n8n callback path (`backend/app/routers/webhooks.py`, unexamined).
- Once `status != "draft"`, `POST /api/calendar/generate` targeting that
  calendar is rejected `409` (Decision 3, immutable-once-confirmed).

**`ContentEntry.status`**: `idea → drafted → recorded → published` — this is
a user-driven content-production workflow, not enforced as a strict state
machine by the API. `PUT /api/calendars/{id}/entries/{entry_id}` accepts any
of the four values regardless of the current one, **independent of the
parent calendar's status** (Decision 3 — entries stay editable even after
`confirmed`).

## API Surface

All endpoints require `Depends(get_current_user)` and filter by the
authenticated `user_id`, mirroring `backend/app/routers/profile.py` /
`openspec/specs/creator-profile/spec.md:119-136`. No streaming (Decision 4):
every endpoint returns a complete JSON body once processing finishes.

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/calendar/generate` | required | `CalendarGenerateRequest` (`period` required; `frequency`, `formats`, `calendar_id` optional — see below) | `200 CalendarDetailResponse` (calendar + entries) | `401` no token · `409 {detail, missing_fields}` when `profile_service.get_status()` returns `is_complete: false` · `409` when `calendar_id` targets a non-`draft` calendar · `404` when `calendar_id` doesn't belong to the caller · `422` invalid request body |
| `GET /api/calendars` | required | — | `200 list[CalendarResponse]`, caller's calendars only, newest first | `401` |
| `GET /api/calendars/{id}` | required | — | `200 CalendarDetailResponse` | `401` · `404` not found/not owned |
| `PUT /api/calendars/{id}/entries/{entry_id}` | required | `EntryUpdate` (partial) | `200 EntryResponse` | `401` · `404` calendar or entry not found/not owned · `422` invalid field value |
| `POST /api/calendars/{id}/confirm` | required | — | `200 CalendarResponse` (`status: "confirmed"`) | `401` · `404` · `409` when `status != "draft"` |
| `DELETE /api/calendars/{id}` | required | — | `204` | `401` · `404` · `409` when `status == "synced"` |

`calendar_id` (optional, new field on `CalendarGenerateRequest`) targets an
existing `draft` calendar for in-place regeneration (Decision 3's "regenerate
in place"); when omitted, generation always creates a new `ContentCalendar`
row. This mechanism is not fully specified by the exploration — flagged in
the question round below.

### Schema tightening (Decision 6)

```python
FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]
PeriodLiteral = Literal["current_week", "next_week", "month"]

class CalendarGenerateRequest(BaseModel):
    period: PeriodLiteral
    frequency: int | None = Field(default=None, ge=1, le=14)
    formats: dict[FormatLiteral, int] | None = None
    calendar_id: str | None = None  # UUID of an existing draft to regenerate
```

`frequency`/`formats` become optional (not just untyped) specifically to make
Decision 7's profile-fallback path reachable when the caller omits them.
`EntryUpdate.format`/`platform` are tightened to the same closed literals as
the model's inline comments (`backend/app/models/calendar.py:60-65`); the
`CalendarResponse`/new `EntryResponse`/`CalendarDetailResponse` schemas use
`model_config = ConfigDict(from_attributes=True)` to serialize ORM rows
directly, matching `ProfileResponse`'s existing pattern.

## RAG Degradation (Decision 5)

`query_rag` performs exactly one Qdrant query per generation request (not
per-entry, Decision 2), grounding on the resolved `niche`/`sub_niche`. If
Qdrant is unreachable or returns nothing, `rag_context` is set to `""` and
the graph proceeds — `generate_ideas` must produce a reasonable result from
profile fields alone, mirroring CRAG's existing fallback pattern
(`backend/app/services/rag_service.py:162-167`). This does not fix the
Qdrant boot blocker; it only makes the calendar path not hard-fail because of
it.

## Approach

**Agent**: multi-node `StateGraph` (Decision 2,
`CONTENTSPARK_SAAS_ROADMAP.md:238-246`) — `receive_params` normalizes the
request into `CalendarState`, `analyze_profile` resolves frequency/formats
per the fallback rule, `query_rag` does the single Qdrant call,
`generate_ideas` is the one Groq call using
`ChatGroq(...).with_structured_output(PydanticModel)` (new territory in this
codebase — `backend/app/services/llm_services.py:21-25` has no prior
`with_structured_output` usage) to produce a list of entry ideas,
`optimize_distribution` is **deterministic Python** (no LLM call) enforcing
"no two consecutive entries share a format" and "entry count matches
resolved `frequency` × period length", and `format_calendar` maps the
optimized ideas onto actual calendar dates within the period and returns
`calendar_entries`.

**Service**: `calendar_service.py` owns the soft-gate check (calls
`profile_service.get_status()`, raises the `409` before invoking the agent),
CRUD, and the status-transition guards (`draft`-only regeneration,
`draft`-only confirm), mirroring `profile_service.py`'s
`flush()`+`refresh()`, `scalar_one_or_none()` conventions
(`backend/app/services/profile_service.py:1-123`).

**Router**: thin, `backend/app/routers/chats.py`-style handlers; registered
in `backend/main.py` alongside the existing five routers.

**Frontend gap** (discovered while reading the mocked components, not
previously flagged in the exploration): the roadmap's UI spec
(`CONTENTSPARK_SAAS_ROADMAP.md:256-262`) calls for a frequency/format/period
configuration panel, a "Generar con AI" trigger, and an entry-edit modal —
**none of these exist today**, not even as disabled stubs.
`TopBar.tsx:1-91` has a live month/week toggle and four disabled
"Próximamente" controls (view tabs, sync, notifications); `TimelineCards.tsx`
and `CalendarGrid.tsx` render only static arrays with disabled pagination/menu
buttons. So "wiring the 7 mocked components to real data" splits into three
different kinds of work, not one:
1. **Real-data wiring**: `TimelineCards`, `CalendarGrid` (remove hardcoded
   arrays, fetch from `GET /api/calendars/{id}`, make `CalendarGrid`
   date-aware for the actual period and the existing month/week toggle).
2. **New UI**: a generate/config control (frequency, period, format
   distribution, submit) and an entry-edit modal — genuinely new components,
   not just un-disabling existing buttons.
3. **Stays mocked, explicitly out of scope**: `GoogleSyncButton`,
   `PerformancePanel`, `ActivityPanel`, `CreatorTip` — none are backed by any
   of the six in-scope endpoints.

## Delivery-Slice Plan

Forecast is comparable to or larger than the archived onboarding-profile
change (~1545 changed lines across 13 sub-phases,
`openspec/changes/archive/2026-08-02-onboarding-profile/tasks.md:351-357`) —
this change adds a LangGraph agent with a novel `with_structured_output` call
on top of an equivalent backend-CRUD + frontend-wizard shape, plus more net-new
frontend UI than onboarding-profile needed. **400-line budget risk: High**,
carried forward from `exploration.md:85`. Units below are sequential,
independently committable, straight to `main` (no chained PRs), same
convention as the archived change.

| # | Unit | Estimated lines | Depends on |
|---|---|---|---|
| 1 | Backend: schema tightening (`schemas/calendar.py`) + finalize `CalendarState` (`shared_state.py`) | ~100 | — |
| 2 | Backend: `calendar_service.py` (CRUD, soft-gate check, status-transition guards) + tests | ~250 | 1 |
| 3 | Backend: `calendar_agent.py` deterministic nodes (`receive_params`, `analyze_profile`, `optimize_distribution`, `format_calendar`) + tests with mocked profile/RAG | ~220 | 1 |
| 4 | Backend: `query_rag` + `generate_ideas` (structured-output Groq call) + tests with mocked LLM | ~200 | 3 |
| 5 | Backend: `routers/calendar.py` + `main.py` registration + router tests (401/404/409/422 cases) | ~220 | 2, 4 |
| 6 | Frontend: `calendar-api.ts` service layer + types + tests | ~130 | 5 (contract frozen) |
| 7 | Frontend: `calendarStore.ts` (Zustand) + generation hook + tests | ~150 | 6 |
| 8 | Frontend: wire `TimelineCards`/`CalendarGrid` to real data, date-aware month/week rendering + tests | ~220 | 7 |
| 9 | Frontend: new generate/config control (frequency, period, formats, submit) + tests | ~180 | 7 |
| 10 | Frontend: entry-edit modal wired to `PUT .../entries/{entry_id}` + tests | ~170 | 6 |
| 11 | Frontend: confirm action + status badges + `/calendar` empty-state CTA to `/onboarding` (soft-gate UI) + tests | ~150 | 8, 9 |

**Total estimate: ~1990 lines.** Every unit individually is at or near the
400-line budget already at this granularity; `sdd-tasks` should evaluate
further splitting within units 2-5 and 8-11 (RED/GREEN sub-phases, as the
archived change did), not treat this table as final. `Chained PRs
recommended: likely yes, to be confirmed at sdd-tasks` — same open decision
the archived change surfaced (`tasks.md:379-386`).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Qdrant boot blocker prevents manual smoke-testing of `query_rag`/`generate_ideas` | High | Same `conftest.py` `sys.modules` stubbing pattern as CRAG/profile tests; accept no live curl until the blocker is fixed (unchanged from onboarding-profile's accepted risk) |
| No `with_structured_output` precedent on Groq/Llama-3.1-8B in this codebase | Med | Small spike inside unit 4 before committing; explicit JSON-repair fallback if the model doesn't reliably honor the Pydantic schema; unit-test with a mocked LLM response |
| `optimize_distribution`'s "no repeated formats/dates" constraint is under-specified until `sdd-design` | Med | Keep it deterministic Python (already locked) so it is unit-testable in isolation from the LLM |
| 400-line budget — every unit is already near/at budget | High | Same mitigation as onboarding-profile: split further at `sdd-tasks` into RED/GREEN sub-phases; sequential single-branch delivery, no chained-PR ambiguity carried into `sdd-apply` |
| Frontend gap (generate control + edit modal) is larger than "wiring" implied | Med | Explicitly scoped as new UI in units 9-10 above, not folded silently into unit 8 |
| `calendar_id`-based regeneration targeting is a proposal-level design choice, not confirmed by the user | Med | Surfaced in the question round below; cheap to change before `sdd-design` locks it |
| Route-guard drift (`proxy.ts:70` `/calendar` bypass) misread as unintentional by future readers | Low | Documented here and in an inline comment at `proxy.ts:70` as a deliberate soft-gate decision, not dead code |

## Success Criteria

- [ ] `mamba run -n contentspark pytest backend/tests` and
      `pnpm --dir frontend test` are green, including new calendar suites.
- [ ] `POST /api/calendar/generate` for a user with an incomplete profile
      returns `409` with `missing_fields`; `/calendar` still renders (empty
      state + CTA), it does not 500 or redirect.
- [ ] `POST /api/calendar/generate` for a complete profile with no
      `frequency`/`formats` supplied falls back to
      `FREQUENCY_RECOMMENDATIONS[niche]` and a documented default format mix.
- [ ] Regenerating a `draft` calendar (same `calendar_id`) replaces its
      entries in place; regenerating a `confirmed` calendar returns `409`.
- [ ] `POST /api/calendars/{id}/confirm` transitions `draft → confirmed`
      exactly once; a second confirm call is `409`.
- [ ] `PUT /api/calendars/{id}/entries/{entry_id}` succeeds regardless of the
      parent calendar's status.
- [ ] Every endpoint returns `401` without a token and never leaks another
      user's calendar (`404`, not another user's data).
- [ ] If Qdrant is unreachable, generation still completes (`rag_context ==
      ""`), does not 500.
- [ ] `TimelineCards`/`CalendarGrid` render real data with no hardcoded
      sample arrays or fixed month remaining in the diff.
- [ ] `ruff check backend/` reports no new findings beyond the pre-existing
      documented debt.
- [ ] No file under `backend/alembic/versions/` is added.

## Proposal Question Round

These are product-shaping gaps the locked decisions do not fully resolve.
Working assumptions are stated above and used throughout this proposal so
work is not blocked.

**RESOLVED — user ruling (2026-08-02).** Assumptions 1, 3, 4, and 5 are
ACCEPTED as written. Assumption 2 is OVERRIDDEN: unrestricted delete
contradicts Decision 3 (immutable-once-`confirmed`) and would orphan events
that Fase 4 has already pushed to Google Calendar. The binding rule is:
`DELETE /api/calendars/{id}` is allowed on `draft` and `confirmed`
calendars, and returns `409` on `synced` calendars. `sdd-spec` and
`sdd-design` treat all five as locked.

1. **Regeneration targeting** — should `POST /api/calendar/generate` accept
   an optional `calendar_id` to regenerate a specific existing `draft` in
   place (this proposal's assumption), or should the UI only ever operate on
   an implicit single "current draft" per user? The former allows multiple
   draft calendars (e.g. one per period) to coexist; the latter is simpler
   but may surprise a user who generated a `month` draft and then a
   `next_week` draft expecting both to persist.
2. **Delete semantics** — should `DELETE /api/calendars/{id}` be allowed on
   `confirmed`/`synced` calendars (this proposal's assumption: unrestricted),
   or blocked once confirmed, mirroring the regenerate lock, to protect data
   Fase 4 may have already synced to Google Calendar?
3. **Decorative widgets** — `PerformancePanel`, `ActivityPanel`, `CreatorTip`
   have no backing endpoint anywhere in the roadmap's six-endpoint list.
   This proposal's assumption is they stay fully mocked/decorative. Does the
   business want at least `ActivityPanel` to reflect real entry data (e.g.
   "3 entries due today") as part of this change, or is that explicitly
   future work?
4. **New UI scope confirmation** — the roadmap specifies a frequency/format
   config panel, a "Generar con AI" trigger, and an entry-edit modal, none of
   which exist even as disabled stubs today. This proposal treats building
   them as in-scope net-new UI (units 9-10). Confirm that framing rather than
   treating them as pre-existing "wiring" targets, since it changes the
   delivery-slice line-count forecast materially.
5. **`desired_frequency` string parsing** — should the agent attempt
   best-effort leading-integer extraction from `profile.desired_frequency`
   (free text, e.g. `"3 por semana"`) before falling back to the niche
   table, or should it always ignore that field and use
   `FREQUENCY_RECOMMENDATIONS[niche]` whenever the caller didn't supply an
   explicit `frequency` (this proposal's assumption — simpler, no parsing
   magic, but may ignore a value the user typed during onboarding)?
