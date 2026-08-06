# Proposal: Per-Creator Timezone for Calendar Period Resolution

**Modules affected**: backend (SQLAlchemy model, Alembic, Pydantic schemas, LangGraph
calendar agent) **and** frontend (onboarding submission, profile form).

## Intent

### The problem

When a creator asks ContentSpark for a calendar for `current_week`, `next_week`, or
`month`, the backend decides what "today" means using the FastAPI server's local clock:
`backend/app/agents/calendar_agent.py:90` calls `date.today()` inside
`_resolve_period(period)`. That value flows through `receive_params`
(`calendar_agent.py:130`) into `start_date`/`end_date`, is persisted onto
`ContentCalendar` (`calendar_service.py:164-166`), and anchors every generated
`ContentEntry.date`.

The server's local date is not the creator's local date. A creator in Buenos Aires
(UTC-3) generating a calendar at 22:00 on a Sunday gets a "current week" that a
UTC-hosted server already considers Monday — so the week the product promises and the
week the product delivers are off by one. The same skew moves month boundaries at
month-end and shifts entries onto dates the creator did not ask for. Because
`ContentEntry` rows are delete-then-inserted per generation
(`calendar_service.py:158-160`), the creator sees entries appear on the wrong days or
apparently vanish from the timeline they were looking at.

There is currently no timezone anywhere in the system: `CreatorProfile`
(`backend/app/models/profile.py`) has 11 columns and none of them is a timezone, and
`Intl.DateTimeFormat` appears nowhere in the frontend. The product has no way to know
where its users are, so it cannot be correct for any of them except by accident of
deploy region.

### Why now

`content-calendar` (Fase 3) is complete at 49/49 tasks and its exit criteria explicitly
forbid adding files under `backend/alembic/versions/`, so the fix could not land there.
Fase 4 (n8n → Google Calendar sync) will push these same dates into real calendars where
an off-by-one day is a visible, user-reported defect rather than an internal
inconsistency. Fixing the anchor before sync ships is materially cheaper than fixing it
after.

### Success

An authenticated creator's calendar period is resolved against *their* timezone, not the
server's. Timezone is captured silently at onboarding, is visible and editable at
`/profile`, is stored as an IANA name so it survives DST transitions, is validated at
the API boundary so invalid input can never reach `ZoneInfo()`, and defaults safely to
UTC for every profile that predates this change.

## Scope

### In Scope

- **`CreatorProfile.timezone`** — new nullable IANA-name column
  (`backend/app/models/profile.py`), e.g. `"America/Argentina/Buenos_Aires"`, plus one
  new Alembic revision chaining off the current head
  `e7f16d584e97_drop_users_onboarding_completed.py`.
- **Schema surface and validation** — `timezone` added to `ProfileCreate` (optional),
  `ProfileUpdate`, and therefore `ProfileResponse` (which inherits from `ProfileCreate`,
  `backend/app/schemas/profile.py:44`), with a Pydantic field validator rejecting any
  value not in `zoneinfo.available_timezones()`.
- **Timezone-aware period resolution** — `_resolve_period(period, tz)` in
  `backend/app/agents/calendar_agent.py` computes `today` as
  `datetime.now(ZoneInfo(tz)).date()`; `receive_params` reads the timezone out of
  `state["profile"]`.
- **Timezone transport into the agent** — `_narrow_profile`
  (`backend/app/services/calendar_service.py:34-44`) grows from 7 to 8 keys. No new
  top-level `CalendarState` key: the value travels inside the existing `profile` dict.
- **Removal of the inert `date.today()`** at `calendar_service.py:131` (see Decisions).
- **Onboarding auto-detect** — `frontend/features/onboarding/hooks/useOnboardingWizard.ts`
  adds `Intl.DateTimeFormat().resolvedOptions().timeZone` to the `submit()` payload. No
  new wizard step; the wizard stays at 4 steps and the creator is never asked.
- **Profile editing** — a timezone field in `frontend/features/profile/components/ProfileForm.tsx`
  following the existing `EditableFields`/`toEditable`/`diffEditable` pattern.
- **One-time nudge for existing creators** — a dismissible banner shown to a signed-in
  creator whose profile timezone is NULL, linking to `/profile` (see Decisions, item 5).
- **Test rewrite** — the 4 tests at `backend/tests/test_calendar_agent.py:95-160`
  monkeypatch `calendar_agent.date` with a `FixedDate.today()` subclass. That patch point
  disappears when `_resolve_period` switches to `datetime.now(ZoneInfo(tz))`; these tests
  are rewritten, not merely extended.
- **Delta specs** for the affected capabilities (see "Affected capabilities").

### Out of Scope

- **`TimelineCards.tsx`'s browser-local `now`** (`frontend/features/calendar/components/TimelineCards.tsx:111`)
  — declared a non-goal (see Decisions).
- **`CalendarGrid.tsx:87`'s `new Date()`** — it is only the no-calendar-loaded fallback;
  the normal-path anchor is the server-resolved `currentCalendar.start_date`. Untouched.
- **Backfilling timezone for existing profiles.** No data migration. `ContentEntry.date`
  is a pure `Mapped[date]` and `time_slot` a nullable semantic string
  (`backend/app/models/calendar.py:51-56`); timezone only matters at period-resolution
  time, so already-generated calendars are left exactly as they are.
- **Making timezone a required onboarding field.** `REQUIRED_PROFILE_FIELDS`
  (`backend/app/services/profile_service.py:13-18`) is not extended; a missing timezone
  never blocks calendar generation via the 409 soft gate.
- **Timezone-aware `time_slot`.** `morning`/`afternoon`/`evening` stay semantic labels;
  no hour arithmetic, no per-creator slot hours.
- **Timezone for chat, RAG, ingestion, or any non-calendar surface.**
- **Google Calendar / n8n timezone propagation** (Fase 4). This change makes the stored
  dates correct; wiring an IANA timezone into a Google Calendar event payload is Fase 4's
  work.
- **A timezone picker with search/geo-detection UX.** A plain select or text input over
  the IANA list is enough; polish is later refinement.

## Approach

1. **Store an IANA name, never an offset.** A numeric offset (`-03:00`) is wrong for half
   the year in any DST-observing zone and would silently regress every October and March.
   `String(64)` is sufficient for the longest IANA identifiers.
2. **Validate at the API boundary, not at generation time.** `ZoneInfo("garbage")` raises
   `ZoneInfoNotFoundError`. Deferring validation to `_resolve_period` means a bad value
   persists silently and then explodes inside a LangGraph node, far from the request that
   caused it. A Pydantic validator on `ProfileCreate`/`ProfileUpdate` checking membership
   in `zoneinfo.available_timezones()` turns that into a 422 at the boundary.
3. **Keep the runtime fallback anyway.** Validation at write time does not make
   `_resolve_period` safe for the pre-existing NULL rows, so it still falls back to UTC
   when the value is `None`. Defence in depth, not redundancy.
4. **Auto-detect silently.** Asking a creator to pick a timezone during onboarding adds a
   step, a decision, and a drop-off point for information the browser already knows
   correctly. Detect it, store it, and expose it at `/profile` for the minority who need
   to correct it (travellers, VPN users, wrong OS clocks).
5. **Carry timezone inside the existing narrowed profile dict.** Adding an 8th key to
   `_narrow_profile` costs one line and no contract change, whereas a new top-level
   `CalendarState` key would ripple through the agent's node signatures and the
   `content-calendar` state contract that was just frozen.
6. **Rewrite the frozen-clock tests around an explicit timezone argument.** The new
   `_resolve_period(period, tz)` is more testable than the old one: passing a known
   timezone plus a patched `datetime` lets the tests assert boundary behaviour (Sunday
   22:00 in Buenos Aires vs. Monday 01:00 UTC) that the old `FixedDate` pattern could not
   express at all.

## Decisions

**1. The inert `date.today()` at `calendar_service.py:131` — cleaned up.**
It seeds a throwaway `start_date`/`end_date` on a brand-new draft `ContentCalendar`
(lines 136-137) that is unconditionally overwritten at lines 164-166 from
`final_state["start_date"]`/`["end_date"]`. It is functionally inert and is *not* a
second bug site. It is removed anyway, because leaving a server-local `date.today()` in a
file this change is explicitly making timezone-correct is a trap for the next reader, who
will reasonably assume it matters. The replacement seeds the placeholder from the same
timezone-resolved value or from an obviously-placeholder constant, with a comment stating
that it is overwritten. Cost: ~4 lines. Correcting the prior session's "two problem call
sites" framing is part of this change's record.

**2. `TimelineCards.tsx`'s browser-local `now` — declared a non-goal.**
Line 111 (`const now = new Date()`) drives the 48-hour "upcoming" window
(`isWithinNextWindow`, lines 91-95) against `entry.date` plus a semantic
`time_slot`→hour mapping (`parseEntryDateTime`, lines 78-89). It is a *display filter*,
not a data-correctness issue: it can only make a card appear or not appear in the
"upcoming" strip, never change a stored date. Crucially, the browser's timezone is the
same source this change uses to populate the profile, so for the overwhelming majority of
creators the two already agree — the disagreement only appears for a creator who
deliberately overrode their profile timezone to something other than their browser's.
Bringing it into agreement means threading the profile timezone into the calendar feature's
data layer and doing timezone-aware date math in TypeScript, which is a meaningfully
larger frontend change than the rest of this proposal combined. Deferred, with the
residual inconsistency recorded as a known limitation rather than silent drift.

**3. Validation location and invalid-input behaviour — reject at the API boundary.**
A Pydantic field validator on `ProfileCreate.timezone` and `ProfileUpdate.timezone`
checks membership in `zoneinfo.available_timezones()` and raises, producing a FastAPI 422
with a clear message. Silently falling back to UTC on invalid input is rejected: it makes
the field lie (the creator sets `America/Bogota`, the profile reads UTC, and the calendar
is wrong with no signal anywhere). Explicit failure at the boundary is the only behaviour
a creator can act on. Note that `available_timezones()` is the running tzdata's view, so a
value valid on one machine is valid wherever the same tzdata is deployed; the set is
computed once at module import, not per request.

**4. Fallback for existing NULL-timezone profiles — UTC.**
The column is nullable with no default and no backfill. `_resolve_period` treats `None`
(and only `None`) as UTC. UTC is chosen over "server local" because server local is
exactly the implicit, deploy-dependent behaviour this change exists to remove; UTC is at
least stable and explicit. Existing creators silently pick up a real timezone the first
time they save their profile or re-run onboarding, and any creator can set it immediately
at `/profile`. `REQUIRED_PROFILE_FIELDS` is deliberately not extended, so a NULL timezone
never blocks generation.

**5. Existing creators — a one-time dismissible nudge (user decision, overrides the
original "passive" assumption).**
Passive correction was the proposal's first assumption and the user rejected it. The
reason it was rejected is the reason it should have been rejected: a creator in Buenos
Aires sitting on a NULL timezone experiences a 3-hour skew as "the calendar is still
slightly wrong" and has no way to connect that symptom to a profile field they have never
seen. Passive correction fixes the mechanism while leaving the creator inside the bug.

A dismissible banner is shown when the signed-in creator's profile timezone is NULL,
linking to `/profile`. Constraints that keep it cheap:
- It reads the timezone already present in the profile payload the app fetches; it
  introduces no new endpoint and no extra request.
- Dismissal is client-side only (persisted in `localStorage`). No new column, no new API
  field, no migration beyond the one this change already carries.
- Auto-detecting and silently writing the timezone on next login was considered and
  rejected: it writes to a creator's profile with no explicit action, which is a heavier
  thing to do than the silent capture at onboarding, where the creator is actively
  submitting the profile in the first place.

Cost: ~45 additional frontend lines plus ~20 of tests, which pushes the estimate over the
400-line budget and makes the chained-slice decision below a firm recommendation rather
than a coin flip.

## Affected capabilities (delta specs required)

- **`creator-profile`** (`openspec/specs/creator-profile/spec.md`, promoted) — deltas
  under `Requirement: Profile Read` (timezone is returned), `Requirement: Profile Creation
  and Update` (timezone is settable and clearable), and `Requirement: Input Validation`
  (invalid IANA name is rejected at the boundary). `Requirement: Completion Status
  Contract` is explicitly *not* modified — timezone stays out of the required set.
- **`creator-onboarding`** (`openspec/specs/creator-onboarding/spec.md`, promoted) — delta
  adding that the submission payload carries a browser-detected IANA timezone without
  adding a wizard step or a user-facing question.
- **`content-calendar-generation`** — the existing
  `Requirement: Entries Scheduled Within the Requested Period`
  (`openspec/changes/content-calendar/specs/content-calendar-generation/spec.md:174-185`)
  says entries fall within "the requested period" but never says *whose* week or month.
  This change makes that explicit: the period is resolved in the creator's stored
  timezone, falling back to UTC. **Open sequencing question**: `content-calendar` is
  49/49 but not yet archived, so this capability spec still lives under
  `openspec/changes/content-calendar/specs/`. If `content-calendar` is archived before
  this change applies, the delta targets the promoted
  `openspec/specs/content-calendar-generation/spec.md`; if not, `sdd-spec` must resolve
  which base file exists and target accordingly rather than editing a frozen change's
  spec in place.

## Risks

- **Test-suite churn is a real cost, not a rounding error.** Four existing tests
  (`test_calendar_agent.py:95-160`) depend on a monkeypatch pattern that stops working.
  Under strict TDD these must be rewritten before the production change, and a partially
  rewritten suite is a broken suite — this is the single most likely place for the change
  to stall mid-apply.
- **`zoneinfo` needs tzdata.** On a container image without system tzdata,
  `available_timezones()` is empty and `ZoneInfo()` fails for every value, which would
  make validation reject *everything*. The `tzdata` package may need to be added to
  `backend/requirements.txt` depending on the deploy base image. This must be verified,
  not assumed.
- **Browser-detected timezone is not always the creator's intended timezone.** VPNs,
  travel, and misconfigured OS clocks all produce a plausible-but-wrong IANA name that the
  creator will never notice until a calendar looks off by a day. The `/profile` edit field
  is the mitigation; there is no detection of the mismatch.
- **The residual `TimelineCards` inconsistency is accepted, not solved.** A creator who
  overrides their profile timezone away from their browser's will see the "upcoming"
  strip filter on browser time while dates were generated on profile time.
- **Alembic head contention.** The new revision chains off `e7f16d584e97`. If any other
  in-flight work adds a migration first, this one needs rebasing onto the new head.
- **`ProfileResponse` inherits `ProfileCreate`**, so adding the field to `ProfileCreate`
  changes the response contract automatically. That is intended, but it means the frontend
  `Profile` type must be updated in the same slice or type-checking fails.

## Changed-line estimate (review budget: 400)

| Area | Est. additions + deletions |
|---|---|
| `models/profile.py` + new Alembic revision | ~35 |
| `schemas/profile.py` (field + validator) | ~25 |
| `calendar_agent.py` (`_resolve_period`, `receive_params`) | ~20 |
| `calendar_service.py` (`_narrow_profile`, inert-`today` cleanup) | ~10 |
| `test_calendar_agent.py` rewrite (add + delete) | ~90 |
| New backend timezone tests (schema validation, profile CRUD) | ~60 |
| `useOnboardingWizard.ts` + onboarding payload types | ~15 |
| `ProfileForm.tsx` + profile types/api | ~60 |
| Timezone nudge banner + dismissal persistence | ~45 |
| Frontend tests | ~70 |
| **Total** | **~430 (range 395–500)** |

**Decision needed before apply: Yes**
**Chained PRs recommended: Yes**
**400-line budget risk: High**

With the nudge banner added by user decision, the midpoint now sits *over* the 400-line
budget and the entire range's lower bound is within 5 lines of it. This is no longer a
coin flip: a single PR exceeds the budget. Two chained slices, each independently
deliverable, verifiable, and revertible:

- **Slice 1 — backend (~240 lines)**: model + migration + schema validation +
  `_resolve_period(period, tz)` + `_narrow_profile` + the inert-`today` cleanup + the
  backend test rewrite. Complete and correct on its own: with no frontend change, every
  profile has a NULL timezone and the system behaves as documented UTC rather than
  accidental server-local. That is already a strict improvement.
- **Slice 2 — frontend (~190 lines)**: onboarding auto-detect + profile edit field +
  the NULL-timezone nudge banner + frontend tests. Depends on slice 1's API contract;
  delivers the actual per-creator correctness.

## Exit criteria

1. `CreatorProfile.timezone` exists as a nullable IANA-name column with exactly one new
   Alembic revision chained off `e7f16d584e97`, and `alembic upgrade head` /
   `alembic downgrade -1` both run clean.
2. `_resolve_period(period, tz)` resolves `current_week`/`next_week`/`month` from
   `datetime.now(ZoneInfo(tz)).date()`, and from UTC when `tz` is `None`. No
   `date.today()` remains anywhere in `backend/app/agents/calendar_agent.py` or
   `backend/app/services/calendar_service.py`.
3. `POST`/`PUT` of a profile with an invalid timezone string returns 422; a valid IANA
   name persists and is returned by `GET /api/profile`.
4. A creator with `timezone` set to a zone whose local date differs from UTC's at
   generation time receives period boundaries matching their local date — proven by a test
   at a boundary instant, not by inspection.
5. Onboarding submits a browser-detected IANA timezone with no added wizard step (still
   4 steps) and no new user-facing question.
6. `/profile` shows and can change the timezone using the existing
   `EditableFields`/`diffEditable` pattern.
7. `REQUIRED_PROFILE_FIELDS` is unchanged; generation is never blocked by a missing
   timezone.
8. `mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test` passes,
   with the four previously-`FixedDate`-based tests rewritten rather than deleted or
   skipped.
9. No `ContentEntry` or `ContentCalendar` row is migrated, backfilled, or otherwise
   rewritten.
10. Delta specs exist for `creator-profile` and `creator-onboarding`, and the
    `content-calendar-generation` period-resolution delta targets whichever base file is
    live at apply time.

## Proposal question round

**Status: answered by the user on 2026-08-05, before `sdd-spec` and `sdd-design` ran.**
Questions 1-4 were put to the user directly; question 5 was deferred by the orchestrator
to the review-workload guard that runs after `sdd-tasks`, where the `ask-on-risk` delivery
strategy asks it against a real line count instead of an estimate. Three assumptions were
confirmed and one was overridden. These are settled decisions now — downstream phases
implement them and do not reopen them.

| # | Topic | Outcome |
|---|---|---|
| 1 | Onboarding silence | **Confirmed** — silent auto-detect, no wizard step added |
| 2 | Invalid input | **Confirmed** — 422 hard failure, no silent UTC fallback |
| 3 | Existing creators | **OVERRIDDEN** — one-time dismissible nudge, not passive (see Decisions, item 5) |
| 4 | `TimelineCards` non-goal | **Confirmed** — documented limitation, deferred |
| 5 | Delivery shape | **Deferred** to the post-`sdd-tasks` review-workload guard |

The original questions, as put:

1. **Onboarding silence.** The proposal auto-detects timezone and never shows it during
   onboarding. Is silently storing an inferred location-adjacent attribute acceptable for
   your users, or should the detected value at least be *displayed* (pre-filled,
   confirmable) on the final onboarding step? Assumption: silent, no step added.
2. **Invalid input behaviour.** The proposal rejects an invalid IANA name with a 422
   rather than falling back to UTC. This means a client sending a stale or non-standard
   timezone identifier gets a hard failure on profile save. Assumption: hard failure is
   correct, because a silently wrong timezone is worse than a visible error.
3. **Existing creators.** Every current profile gets UTC until they next save. For a
   creator in Buenos Aires that is a 3-hour skew that they will experience as "the
   calendar is still slightly wrong" until they touch `/profile`. Should there be a
   one-time prompt or banner nudging existing creators to set their timezone, or is
   passive correction on next profile save enough? Assumption: passive, no nudge.
4. **The `TimelineCards` non-goal.** The proposal accepts that the 48-hour "upcoming"
   filter keeps using browser time. This is invisible unless a creator overrides their
   profile timezone. Is that acceptable as a documented limitation, or does the timeline
   filter need to agree with the profile in this change? Assumption: acceptable, deferred.
5. **Delivery shape.** The estimate straddles the 400-line budget. Assumption: two chained
   PRs (backend, then frontend), with the backend slice shippable alone.
