# Tasks: Per-Creator Timezone for Calendar Period Resolution

STRICT TDD is active. Every implementation task is preceded by its RED test
task. Both suites must stay green throughout
(`mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test`).

**Delivery shape**: two chained slices, per `proposal.md`'s recommendation
and the design's §9. Slice 1 (backend) is independently correct and
shippable alone — with no frontend change every profile has a NULL
`timezone` and the system resolves periods in documented UTC instead of
accidental server-local. Slice 2 (frontend) depends on Slice 1's API
contract (`ProfileResponse` gains `timezone`) and delivers actual
per-creator correctness.

Verified before writing this list (do not re-derive; see design §0-§10 and
proposal.md's Decisions):
- `available_timezones()` works locally only via the **conda** `tzdata`
  package; the PyPI `tzdata` package is absent from `backend/requirements.txt`.
  Adding it is Task 1.8 below, not optional.
- There is no Dockerfile anywhere in the repo despite `docker-compose.yml`
  declaring `build: ./backend`/`build: ./frontend`. That is a pre-existing
  defect **outside this change's scope** — no task here creates one. It is
  the reason Task 1.8 is mandatory rather than optional (see Risks).
- `_resolve_period`'s sole production caller is `receive_params`
  (`calendar_agent.py:130`); the separate inert `date.today()` at
  `calendar_service.py:131` is dead code, confirmed unconditionally
  overwritten by `final_state` at lines 164-166.
- `test_calendar_agent.py:95-160`'s four `FixedDate`-monkeypatch tests are
  **rewritten**, not extended — the patch point (`calendar_agent.date`)
  ceases to exist once `_resolve_period` splits into
  `_zone_or_utc`/`_today_in`/`_period_bounds`.
- `test_narrow_profile_returns_exactly_seven_keys`
  (`backend/tests/test_calendar_service.py:36`) asserts full dict equality
  and fails the moment `_narrow_profile` gains an 8th key — its fixture and
  name are updated in the same task as the production change, not as a
  surprise later.
- `ProfileResponse` inherits `ProfileCreate` (`schemas/profile.py:44`), so
  adding `timezone` to `ProfileCreate` widens the response contract for
  free. This breaks the frontend `Profile` TypeScript type and its test
  fixtures under `tsc --noEmit`, **not** under Vitest — a green Vitest run
  does not prove Slice 2 is done. Task 2.9 is an explicit `tsc --noEmit`
  gate for this reason.
- Alembic head is `e7f16d584e97_drop_users_onboarding_completed.py`
  (`down_revision = '04bb76c6e29f'`). If another migration lands first,
  rebase `down_revision` onto the new head — do not create a branch.

---

## Slice 1 — Backend (~240 lines)

Delivers independently. Verifiable by
`mamba run -n contentspark pytest backend/tests`. Revertible by one
`alembic downgrade -1`.

**Ordering constraint (design §6, "the risky pair"):** the RED step in Task
1.1 imports `_period_bounds` at module scope, which makes the entire
`test_calendar_agent.py` file fail to **collect** (not just fail), hiding
~40 unrelated tests behind one `ImportError`. That is legitimate RED for a
brand-new symbol, but the file is blind while it is uncollectable. Tasks 1.1
and 1.2 are therefore atomic: do not interleave any other task between them,
and do not stop mid-pair if execution is interrupted. Full collection must
be restored by the end of 1.2, before any later task starts.

### 1.1 — `_period_bounds`/`_today_in`/`_zone_or_utc` split — RED
- [x] **1.1.1** [RED] In `backend/tests/test_calendar_agent.py`, delete the
  four `FixedDate.today()`-monkeypatch tests at lines 95-160 and replace
  them with `_period_bounds(period, today: date)`-based equivalents that
  pass a literal `date(...)` as the second argument and keep every original
  assertion verbatim: `test_period_bounds_current_week`,
  `test_period_bounds_next_week`, `test_period_bounds_month_short_february`,
  `test_period_bounds_month_31_day`. Add `test_resolve_period_unknown_raises`
  (now `_resolve_period("not_a_real_period", None)`, one token added). Add
  `test_today_in_none_is_utc`, `test_today_in_applies_zone_offset`,
  `test_today_in_invalid_zone_falls_back_to_utc` per `design.md`'s table
  (§6). Add the exit-criterion-4 proof,
  `test_resolve_period_week_differs_across_utc_boundary`, asserting the two
  different weeks produced by the same instant
  (`datetime(2026, 8, 3, 1, 0, tzinfo=UTC)`) under
  `"America/Argentina/Buenos_Aires"` vs. `None`. Expect the whole file to
  fail to **collect** (`ImportError` on `_period_bounds`) — this is the
  legitimate, expected RED state.
  Spec: content-calendar-generation / Entries Scheduled Within the Requested
  Period (all 3 scenarios).

### 1.2 — `_period_bounds`/`_today_in`/`_zone_or_utc` split — GREEN
- [x] **1.2.1** [GREEN] In `backend/app/agents/calendar_agent.py`: add
  `_zone_or_utc(tz: str | None) -> tzinfo` (never raises, falls back to
  `UTC` on `ZoneInfoNotFoundError`/`ValueError`), `_today_in(tz: str | None,
  now: datetime | None = None) -> date` (the injectable-clock seam — `now`
  is a test-only parameter, production never passes it), `_period_bounds(period:
  str, today: date) -> tuple[date, date]` (pure calendar arithmetic, no
  clock, no timezone — the existing week/month logic moved verbatim), and
  rewrite `_resolve_period(period: str, tz: str | None, now: datetime | None
  = None) -> tuple[date, date]` as a two-line composition of the above. `tz`
  is a **required positional parameter**, no default (design D7). Run 1.1.1
  to green — full file collection restored, whole file passes.
  Spec: content-calendar-generation / Entries Scheduled Within the Requested
  Period.

**Ordering constraint ends here** — Tasks 1.3 onward may interleave freely
subject to their own within-pair RED/GREEN atomicity.

### 1.3 — `receive_params` timezone wiring — RED
- [x] **1.3.1** [RED] Add `test_receive_params_uses_profile_timezone` (state
  with `profile={"timezone": "Pacific/Kiritimati"}`, asserted relationally
  against `_period_bounds("current_week", _today_in("Pacific/Kiritimati"))`
  so the assertion cannot flake at a date boundary) and
  `test_receive_params_missing_timezone_key_resolves_utc` (state with the
  pre-existing 7-key profile, no `timezone` key, asserted equal to the UTC
  bounds) to `backend/tests/test_calendar_agent.py`.
  Spec: content-calendar-generation / Entries Scheduled Within the Requested
  Period (NULL-timezone-falls-back-to-UTC scenario).

### 1.4 — `receive_params` timezone wiring — GREEN
- [x] **1.4.1** [GREEN] In `calendar_agent.py`'s `receive_params`
  (lines 128-138), change to `profile = state.get("profile") or {}` and
  `start_date, end_date = _resolve_period(state["period"],
  profile.get("timezone"))`. Run 1.3.1 to green. Run the full backend suite
  — must stay green.

### 1.5 — `_narrow_profile` 7→8 keys — RED
- [x] **1.5.1** [RED] In `backend/tests/test_calendar_service.py`, rename
  `test_narrow_profile_returns_exactly_seven_keys` (line 36) to
  `test_narrow_profile_returns_exactly_eight_keys`, add `"timezone":
  "America/Bogota"` to its expected dict, and add a `timezone` key to the
  `_fake_creator_profile` base fixture dict (lines 23-31). Add
  `test_narrow_profile_preserves_null_timezone` asserting
  `timezone=None` on the fixture stays `None` in the narrowed dict (not
  coerced to `""` or `"UTC"`).
  Spec: content-calendar-generation / Entries Scheduled Within the Requested
  Period (timezone transport).

### 1.6 — `_narrow_profile` 7→8 keys — GREEN
- [x] **1.6.1** [GREEN] In `backend/app/services/calendar_service.py`'s
  `_narrow_profile` (lines 34-44), add `"timezone": profile.timezone,` —
  **no** `or []`/`or ""` coercion; `None` is a meaningful value here (means
  UTC downstream). In the same task, replace the inert `date.today()` seed
  at line 131 with `placeholder = date.min` and the two `ContentCalendar`
  construction call sites' `start_date`/`end_date`, plus the inline comment
  noting it is unconditionally overwritten from `final_state` at Paso 5. Run
  1.5.1 to green. Run the full backend suite — must stay green.
  Spec: content-calendar-generation / Entries Scheduled Within the Requested
  Period.

### 1.7 — Schema validation — RED
- [x] **1.7.1** [RED] Add tests (new or extending
  `backend/tests/test_profile_schemas.py`, following the existing schema
  test file for this router if one exists, else create it mirroring
  `test_calendar_schemas.py`'s pattern) asserting: `ProfileCreate` and
  `ProfileUpdate` accept a valid IANA name (e.g.
  `"America/Argentina/Buenos_Aires"`) and accept `None`; both raise
  `pydantic.ValidationError` on `"Mars/Olympus_Mons"` and on `""`.
  Spec: creator-profile / Input Validation (valid-accepted and
  invalid-rejected scenarios).

### 1.8 — Schema validation + `tzdata` — GREEN
- [x] **1.8.1** [GREEN] In `backend/app/schemas/profile.py`: add the
  `_AVAILABLE_TIMEZONES` frozenset computed once at import from
  `zoneinfo.available_timezones()`, with the degrade-not-fail-closed
  `_validate_timezone` function and `TimezoneName = Annotated[str | None,
  AfterValidator(_validate_timezone)]` alias (design §3, verbatim). Add
  `timezone: TimezoneName = None` to `ProfileCreate` and `ProfileUpdate`.
  Log a warning once at import if `_AVAILABLE_TIMEZONES` is empty (degraded
  mode, never a hard failure of every value). In the same task, add `tzdata`
  (unpinned, matching the file's existing convention) to
  `backend/requirements.txt` under a new section with the inline comment
  from `design.md` §2 explaining why it is required (zoneinfo falls back to
  it when the deploy image lacks system tzdata — this is a required task,
  not optional, because the local pass comes from a **conda** package
  invisible to pip and the deploy image does not exist yet). Run 1.7.1 to
  green. Run the full backend suite — must stay green.
  Spec: creator-profile / Input Validation.

### 1.9 — Router 422/round-trip — RED
- [x] **1.9.1** [RED] Extend the existing profile router test file
  (`backend/tests/test_profile.py` or equivalent, following the existing
  profile-router test pattern) with: `PUT /api/profile` with an invalid
  `timezone` string returns 422 and does not persist; `PUT /api/profile`
  with a valid IANA name returns 200 and the value round-trips through a
  subsequent `GET /api/profile`; `GET /api/profile` on a profile with no
  stored timezone returns `timezone: null` (not `""`, not `"UTC"`).
  Spec: creator-profile / Profile Read (stored-timezone and
  no-timezone-returns-null scenarios), Profile Creation and Update (set/
  clear/omit scenarios), Input Validation (422 scenario).

### 1.10 — Router 422/round-trip — GREEN
- [x] **1.10.1** [GREEN] Confirm `update_profile`/`complete_onboarding` in
  `backend/app/services/profile_service.py` (lines 75-77, 102-104) require
  no edits — both already `setattr` any attribute the schema has, so
  `timezone` flows through once the model column exists. Run 1.9.1 — expect
  it to still fail (no DB column yet); this is expected, not a bug — column
  creation is Task 1.11/1.12. Do not mark this task green until 1.12 lands.
  Spec: creator-profile / Profile Creation and Update.

### 1.11 — Model column + migration — RED
- [x] **1.11.1** [RED] Confirm 1.9.1 is still red for lack of a `timezone`
  column on `CreatorProfile` (SQLAlchemy attribute error / DB column-missing
  error at the fixture/DB layer). No new test file needed here — 1.9.1
  already exercises this path; this task is the explicit checkpoint before
  the model/migration GREEN.

### 1.12 — Model column + migration — GREEN
- [x] **1.12.1** [GREEN] In `backend/app/models/profile.py`, append after
  `preferred_formats` (line 32): `timezone: Mapped[str | None] =
  mapped_column(String(64), nullable=True)`. Generate a new Alembic revision
  chained off `e7f16d584e97` via `mamba run -n contentspark alembic revision
  --autogenerate -m "add creator_profiles timezone"`, then **hand-check**
  the generated body — it must contain exactly one `op.add_column("creator_profiles",
  sa.Column("timezone", sa.String(length=64), nullable=True))` and its
  `op.drop_column` inverse, nothing else (autogenerate has historically
  emitted unrelated drift on this project). Run `alembic upgrade head` then
  `alembic downgrade -1` then `alembic upgrade head` again — all three must
  run clean. Run 1.9.1 and 1.10.1 to green. Run the full backend suite —
  must stay green.
  Spec: creator-profile / Profile Read, Profile Creation and Update.

### 1.13 — Verify (Slice 1 exit gate)
- [x] **1.13.1** [VERIFY] `mamba run -n contentspark pytest backend/tests`
  — full green, including all rewritten and new tests from 1.1-1.12.
- [x] **1.13.2** [VERIFY] `ruff check backend/` reports no new findings on
  touched/created files (`calendar_agent.py`, `calendar_service.py`,
  `schemas/profile.py`, `models/profile.py`, the new Alembic revision,
  `requirements.txt`, and every touched test file). Pre-existing findings
  elsewhere are untouched debt.
- [x] **1.13.3** [VERIFY] `rg "date.today\(\)" backend/app/agents/calendar_agent.py
  backend/app/services/calendar_service.py` returns no matches — confirms
  exit criterion 2 (no server-local date anywhere in these two files).
- [x] **1.13.4** [VERIFY] Confirm `git status backend/alembic/versions/`
  shows exactly one new file, and `down_revision` still resolves to the
  actual current head (rebase if another migration landed first — see
  Risks).

**Slice 1 exit criteria**: `CreatorProfile.timezone` column exists and
migrates cleanly both directions; `_resolve_period`/`receive_params`/
`_narrow_profile` are timezone-aware with UTC fallback; schema validation
rejects invalid IANA names at 422; `tzdata` is a declared dependency; full
backend suite green; no frontend file touched.

---

## Slice 2 — Frontend (~190 lines)

Depends on Slice 1's API contract (`GET`/`PUT /api/profile` now carry
`timezone`). Verifiable by `pnpm --dir frontend test`, **and** by the
explicit `tsc --noEmit` gate in Task 2.9 — Vitest passing is not sufficient
proof this slice is done (see the `ProfileResponse` inheritance note above).

### 2.1 — `Profile`/`ProfileOnboardingInput`/`ProfileUpdateInput` types — RED
- [x] **2.1.1** [RED] In the relevant frontend type-test or fixture file
  (`ProfileForm.test.tsx`'s `fakeProfile` fixture, `profileStore.test.ts`'s
  fixtures, and any onboarding fixture using `Profile`), add `timezone` to
  each fixture object matching the target shape (`timezone: string | null`
  on `Profile`, `timezone?: string | null` on the input types). Do not
  widen the type definitions yet — this task only updates the fixtures so
  the subsequent `tsc --noEmit` run in Task 2.9 has a fixed target. This is
  a fixture-only change; no assertion changes.

### 2.2 — `Profile`/`ProfileOnboardingInput`/`ProfileUpdateInput` types — GREEN
- [x] **2.2.1** [GREEN] Widen the shared `Profile` type (`timezone: string |
  null`, required — matches the backend response contract, which always
  includes the key), `ProfileOnboardingInput` (`timezone?: string | null`),
  and `ProfileUpdateInput` (`timezone?: string | null`) in
  `frontend/features/profile`'s types module (and the onboarding equivalent
  if separate). Run `pnpm --dir frontend exec tsc --noEmit` — must be clean
  on these files (full-project gate is Task 2.9, this is a scoped early
  check).

### 2.3 — Onboarding auto-detect — RED
- [x] **2.3.1** [RED] In `frontend/features/onboarding/hooks/`'s test file
  for `useOnboardingWizard`, stub `Intl.DateTimeFormat` in jsdom to resolve
  `timeZone: "America/Argentina/Buenos_Aires"` and assert `submit()`'s
  payload includes `timezone: "America/Argentina/Buenos_Aires"`. Add a
  second case asserting `?? null` degradation when `timeZone` is
  `undefined`. Assert `TOTAL_ONBOARDING_STEPS` is unchanged (still 4) and no
  new draft field exists on `OnboardingDraft`/`INITIAL_DRAFT`.
  Spec: creator-onboarding / Multi-Step Wizard Form (browser-detected
  timezone submission scenario, adds-no-step scenario).

### 2.4 — Onboarding auto-detect — GREEN
- [x] **2.4.1** [GREEN] In
  `frontend/features/onboarding/hooks/useOnboardingWizard.ts`'s `submit()`
  payload literal (lines 98-110), add one line: `timezone:
  Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,`. Detected at
  submit time, not hook-mount time. Do **not** touch `OnboardingDraft`,
  `INITIAL_DRAFT`, or `TOTAL_ONBOARDING_STEPS`. Run 2.3.1 to green.
  Spec: creator-onboarding / Multi-Step Wizard Form.

### 2.5 — Curated timezone `<select>` constant + `ProfileForm` field — RED
- [x] **2.5.1** [RED] Add a test for the new curated-timezone-list constant
  (`frontend/shared/constants/`) asserting it is a non-empty array of IANA
  names and does not itself contain `"America/Argentina/Buenos_Aires"`-style
  duplicates. Extend `ProfileForm.test.tsx`: renders a `timezone` `<select>`
  with an empty "Sin especificar" option; `toEditable` seeds it from
  `profile?.timezone ?? ""`; submitting a changed value includes `timezone`
  in the diff via the existing generic string-branch (no `diffEditable`
  code change expected — assert the existing behavior extends correctly);
  **the browser-detected zone (stubbed via `Intl.DateTimeFormat`) is
  prepended to the rendered option list when it is absent from the curated
  constant** — this is the trap flagged in design §7.2/D11: a curated list
  that silently drops a creator's real zone is a regression, not a feature.
  Spec: creator-profile / Profile Creation and Update (timezone set/update/
  clear scenarios, client-side mirror).

### 2.6 — Curated timezone `<select>` constant + `ProfileForm` field — GREEN
- [x] **2.6.1** [GREEN] Add the curated timezone list constant to
  `frontend/shared/constants/` next to `NICHES`/`FORMATS`/`PLATFORMS`
  (Latin America, Spain, major US/EU zones, per design §7.2). In
  `ProfileForm.tsx`: add `timezone: string` to `EditableFields`; `timezone:
  profile?.timezone ?? ""` to `toEditable`; render a `<select>` using the
  same markup pattern as the existing `niche` field (lines 188-200), with
  the empty "Sin especificar" option, **prepending the
  `Intl.DateTimeFormat().resolvedOptions().timeZone` value to the rendered
  option list at component level when it is not already in the curated
  constant** (do not mutate the shared constant itself — compute the
  effective option list per-render). No `diffEditable` change. Run 2.5.1 to
  green.
  Spec: creator-profile / Profile Creation and Update.

### 2.7 — NULL-timezone nudge banner — RED
- [x] **2.7.1** [RED] Create
  `frontend/features/profile/components/TimezoneNudge.test.tsx`: renders
  when the mocked profile store has `profile: {..., timezone: null}` and no
  dismissal in `localStorage`; does **not** render when `profile` is `null`
  (not-yet-loaded — must not flash); does not render when `timezone` is set
  to any non-null value including `"UTC"`; does not render after
  `localStorage.setItem("cs.timezone-nudge.dismissed", "1")` is pre-seeded;
  dismiss button writes that key; contains a `next/link` to `/profile`;
  triggers the same idempotent `if (!profile && !isLoading) void load();`
  mount-guard pattern as `ProfileView.tsx:16-21` (assert the store's `load`
  is called at most once across both mounts when the store is a singleton).
  Spec: creator-profile / Profile Read (stored-timezone-null-vs-not-loaded
  distinction, client-side mirror — no formal spec scenario covers the
  banner itself since dismissal is client-only per proposal Decision 5, but
  the null-vs-unloaded distinction it depends on traces to Profile Read).

### 2.8 — NULL-timezone nudge banner — GREEN
- [x] **2.8.1** [GREEN] Create
  `frontend/features/profile/components/TimezoneNudge.tsx`: visibility
  condition `profile !== null && profile.timezone === null && !dismissed`;
  lazy `useState` initialiser reading `localStorage` once (SSR-safe, never
  touches `localStorage` during server render); one line of Spanish UI copy
  stating the calendar is generated in UTC, a `next/link` to `/profile`, and
  a dismiss button writing `localStorage.setItem("cs.timezone-nudge.dismissed",
  "1")`. Mount in `frontend/app/(app)/layout.tsx` inside `SidebarShell`
  above `{children}`. Run 2.7.1 to green. Run the full frontend suite — must
  stay green.
  Spec: creator-profile / Profile Read.

### 2.9 — Verify (Slice 2 exit gate)
- [x] **2.9.1** [VERIFY] `pnpm --dir frontend test` — full green, including
  every new/updated suite from Tasks 2.1-2.8.
- [x] **2.9.2** [VERIFY] `pnpm --dir frontend exec tsc --noEmit` — clean, or
  no new findings beyond documented pre-existing warnings. This is the
  **required** check for the `ProfileResponse`-inheritance trap: a green
  Vitest run alone does not prove every `Profile`-typed fixture across the
  frontend compiles against the widened type. Do not skip this task even if
  2.9.1 is green.
- [x] **2.9.3** [VERIFY] `pnpm --dir frontend lint` — no new findings.
- [x] **2.9.4** [VERIFY] `git diff frontend/app/(app)/layout.tsx` contains
  only the `TimezoneNudge` mount — no unrelated changes to `SidebarShell` or
  route guards.
- [x] **2.9.5** [VERIFY] Manually confirm `TimelineCards.tsx:111`'s
  browser-local `now` is untouched (out of scope per proposal Decision 2)
  and `CalendarGrid.tsx:87`'s fallback `new Date()` is untouched (out of
  scope, normal-path anchor is server-resolved).

**Slice 2 exit criteria**: onboarding submits a browser-detected timezone
with no added step; `/profile` exposes and edits the timezone via the
existing `EditableFields`/`diffEditable` pattern without losing an
out-of-curated-list zone; the nudge banner correctly distinguishes
"not loaded" from "loaded, NULL" and respects client-only dismissal; `tsc
--noEmit` and Vitest both pass.

---

## Final verification (both slices)

- [x] **F.1** Run `mamba run -n contentspark pytest backend/tests && pnpm
  --dir frontend test` — both green.
- [x] **F.2** Confirm all 10 proposal exit criteria
  (`proposal.md:283-311`) are covered by at least one automated test above;
  do not add new tests here, only confirm coverage via the traceability
  table below.
- [x] **F.3** Confirm `REQUIRED_PROFILE_FIELDS`
  (`backend/app/services/profile_service.py:13-18`) is unchanged (exit
  criterion 7) — `timezone` never blocks generation via the 409 soft gate.
- [x] **F.4** Confirm no `ContentEntry`/`ContentCalendar` row is
  migrated, backfilled, or rewritten by the new Alembic revision (exit
  criterion 9) — the migration is additive-column-only.

---

## Task-to-spec traceability

| Task(s) | Spec requirement |
|---|---|
| 1.1, 1.2, 1.3, 1.4 | content-calendar-generation / Entries Scheduled Within the Requested Period (all 3 scenarios) |
| 1.5, 1.6 | content-calendar-generation / Entries Scheduled Within the Requested Period (timezone transport, NULL fallback) |
| 1.7, 1.8 | creator-profile / Input Validation (valid-accepted, invalid-rejected) |
| 1.9, 1.10, 1.11, 1.12 | creator-profile / Profile Read (stored + null scenarios), Profile Creation and Update (set/update/clear/omit) |
| 2.3, 2.4 | creator-onboarding / Multi-Step Wizard Form (both scenarios) |
| 2.5, 2.6 | creator-profile / Profile Creation and Update (client-side mirror) |
| 2.7, 2.8 | creator-profile / Profile Read (null-vs-unloaded distinction, client-side mirror) |

## Parallelization notes

- Tasks 1.1/1.2 are an **atomic pair** — no parallelism, no interleaving,
  per the ordering constraint above.
- Task 1.7/1.8 (schema validation) has no dependency on 1.1-1.6 and could
  run in parallel with them if two writer threads were available; in
  practice, with one writer, run it after 1.6 to keep the TDD narrative
  linear, matching design §6's numbered sequence.
- Tasks 1.9-1.12 (router/model/migration) depend on 1.8 (schema must exist
  before the router test can assert 422) and are the last backend unit —
  they close Slice 1.
- Slice 2 (all of 2.x) cannot start meaningfully before Slice 1's Task 1.13
  (verify) is complete — the API contract must be frozen first.
- Within Slice 2: 2.1/2.2 (types) should land first since 2.5/2.6 and 2.7/
  2.8 both consume the widened `Profile` type. 2.3/2.4 (onboarding) is
  independent of 2.5-2.8 and can run in parallel with them once 2.1/2.2
  land. 2.7/2.8 (nudge banner) depends on 2.1/2.2 only, not on 2.5/2.6 —
  it reads `profile.timezone`, not the edit form.

---

## Review Workload Forecast

| Unit | Estimated lines | Budget risk |
|---|---|---|
| Slice 1 — model + migration + schema + `_resolve_period` split + `_narrow_profile` + `date.today()` cleanup + backend test rewrite | ~240 | Medium (under 400 alone) |
| Slice 2 — onboarding auto-detect + `ProfileForm` timezone field + curated-list constant + nudge banner + frontend tests | ~190 | Medium (under 400 alone) |
| **Combined, single PR** | **~430 (range 395-500, per proposal's line-item table)** | **High** |

- Estimated changed lines: 430
- Chained PRs recommended: Yes
- 400-line budget risk: High
- Decision needed before apply: Yes

The combined estimate's range (395-500) straddles the 400-line budget with
its lower bound within 5 lines of the limit — a single PR is not a safe
default. Each slice individually lands comfortably under budget (~240 and
~190) and each has a clear start, clear finish, autonomous scope
(Slice 1 verifiable and revertible without Slice 2), and independent
verification command. This matches the proposal's settled recommendation
(question 5, answered: two chained PRs, backend then frontend) and requires
`sdd-apply` to run under a chained/stacked delivery strategy rather than a
single oversized PR.
