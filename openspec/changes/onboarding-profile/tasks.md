# Tasks: Creator Onboarding and Profile

STRICT TDD is active. Every implementation task is preceded by its RED test
task. Both suites must stay green throughout
(`mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test`
— currently 24 backend + 19 frontend).

Verified before writing this list (do not re-derive):
- `backend/app/models/profile.py:32` is `Mapped[dict | None]` over a `JSONB`
  column. Fixing the annotation to `Mapped[list[str] | None]` changes only the
  Python type hint, not the SQL column type — **no Alembic migration is
  required or scheduled for this change.**
- `backend/app/routers/profile.py` is a 2-line stub; `backend/main.py:8,36-39`
  imports and registers only `auth, chat, chats, ingest` — `profile` is
  missing from both.
- `frontend/proxy.ts` (95 lines) already implements the auth redirect,
  `/onboarding` self-exemption (line 45, 63-72), `/calendar` bypass (line 61),
  and the reverse complete→`/chat` redirect (74-78). Only lines 47-53 (the
  dead `user_metadata.onboarding_completed` read) are replaced.
  `frontend/app/(app)/layout.tsx` is NOT touched by any task below.

---

## Phase 1 — Backend: profile API (Slice 1)

Delivers independently: a tested `GET/PUT /api/profile`,
`POST /api/profile/onboarding`, `GET /api/profile/status` surface. No
frontend dependency. No Alembic migration in this phase or any other.

### 1.1 Model annotation fix (no migration) [x]
- **1.1.1** [x] [RED] N/A — this is a type-hint-only change with no runtime
  behavior to assert; covered indirectly by 1.4's round-trip test. Skip a
  dedicated RED test here.
- **1.1.2** [x] [GREEN] Edit `backend/app/models/profile.py:32`:
  `Mapped[dict | None]` → `Mapped[list[str] | None]` (JSONB column
  `preferred_formats` unchanged). Confirm no `alembic revision --autogenerate`
  is generated (column type identical) — run
  `mamba run -n contentspark alembic check` or `revision --autogenerate`
  locally and discard/verify it proposes no diff before committing.
  Spec: creator-profile / Input Validation (type correctness).

### 1.2 Schema fixes and additions [x]
- **1.2.1** [x] [RED] Add failing assertions to `backend/tests/test_profile_service.py`
  (new file, created here) for: `ProfileCreate` accepts
  `current_frequency="3 por semana"` (str, not int) via direct Pydantic
  validation call; `ProfileCreate` rejects missing `niche`; a new
  `ProfileStatusResponse(is_complete: bool, missing_fields: list[str])`
  schema exists and serializes correctly. These will fail against current
  `backend/app/schemas/profile.py`.
  Spec: creator-profile / Input Validation, Completion Status Contract.
- **1.2.2** [x] [GREEN] Edit `backend/app/schemas/profile.py`:
  - Lines 21-22 (`ProfileCreate`) and 35-36 (`ProfileUpdate`):
    `current_frequency`/`desired_frequency` `int` → `str | None`.
  - Make `ProfileCreate` fields optional except the four required
    (`niche`, `primary_goal`, `tone`, `target_audience`) — `display_name`
    becomes `str | None = None` (design D5: empty profile row must be
    representable without a name).
  - Add `ProfileStatusResponse(BaseModel)` with `is_complete: bool`,
    `missing_fields: list[str]`.
  - `ProfileResponse` gets `model_config = ConfigDict(from_attributes=True)`
    so it can serialize a SQLAlchemy `CreatorProfile` row directly.
  Run 1.2.1 to green.

### 1.3 `profile_service.py` — completion rule and CRUD [x]
- **1.3.1** [x] [RED] In `backend/tests/test_profile_service.py`, add unit tests
  (SimpleNamespace fakes, no DB) for `_missing_fields`:
  - all-empty row → all 4 required fields listed
  - whitespace-only `tone` (`" "`) → `tone` counted as missing
  - all four present → `[]`
  - `None` profile → all 4 missing
  Spec: creator-profile / Completion Status Contract, scenarios "New user is
  incomplete", "Profile with only some required fields", "Complete profile".
- **1.3.2** [x] [GREEN] Create `backend/app/services/profile_service.py`
  following `backend/app/services/chat_service.py`'s shape:
  - `REQUIRED_PROFILE_FIELDS: tuple[str, ...] = ("niche", "primary_goal", "tone", "target_audience")`
  - `_missing_fields(profile) -> list[str]` (treats `None` and
    whitespace-only strings as missing; a `None` profile yields all 4)
  - `class ProfileService` with `async def get_or_create_profile(db, user_id) -> CreatorProfile`,
    `async def get_status(db, user_id) -> tuple[bool, list[str]]`,
    `async def update_profile(db, user_id, **fields) -> CreatorProfile`,
    `async def complete_onboarding(db, user_id, payload) -> CreatorProfile`,
    `async def _replace_social_accounts(db, profile, accounts)` (private helper).
  - Use `flush()` + `refresh()`, never `commit()`. `scalar_one_or_none()` for
    lookups. `get_or_create_profile` inserts an empty row scoped to
    `user_id` if none exists (design D5 — `get_current_user` already
    guarantees the FK).
  - Module-level singleton: `profile_service = ProfileService()`.
  Run 1.3.1 to green.

### 1.4 Router + registration [x]
- **1.4.1** [x] [RED] Create `backend/tests/test_profile.py` (router tests via
  `client` fixture) with failing tests, mirroring
  `backend/tests/test_chats.py`'s structure and a new `patch_profile_service`
  fixture (added in 1.4.2 alongside):
  - `GET /api/profile` → 200 with empty-profile shape when service returns
    `None`-like fake; 401 without token.
  - `PUT /api/profile` → 200 partial update round-trip preserving
    unspecified fields (assert body only changes submitted keys); 401
    without token.
  - `POST /api/profile/onboarding` → 200 creating a profile, including
    `current_frequency: "3 por semana"` surviving the round-trip
    unmodified; missing `niche` → 422, no service call; re-submission when a
    row exists calls `update_profile` semantics (asserted via
    `patch_profile_service.complete_onboarding.assert_awaited_once()`); 401
    without token.
  - `GET /api/profile/status` → 200 `{is_complete, missing_fields}` shape;
    401 without token.
  One "no token → 401" test per endpoint (4 total), per skill pattern.
  Spec: creator-profile / all requirements; creator-onboarding / n/a (backend
  has no wizard-specific requirement, only the contract it depends on).
- **1.4.2** [x] [GREEN]
  - Add `patch_profile_service` fixture to `backend/tests/conftest.py`,
    mirroring `patch_chat_service` (lines 115-133): `AsyncMock` for
    `get_or_create_profile`, `get_status`, `update_profile`,
    `complete_onboarding`.
  - Replace the 2-line stub in `backend/app/routers/profile.py` with
    `APIRouter(prefix="/api/profile", tags=["profile"])` and 4 thin handlers
    (`get_profile`, `put_profile`, `post_onboarding`, `get_status`), each
    using `Depends(get_current_user)` / `Depends(get_db)`, plus a
    `_to_profile_response(profile) -> ProfileResponse` helper.
  - Edit `backend/main.py`: add `profile` to the line-8 import
    (`from app.routers import auth, chat, chats, ingest, profile`) and
    `app.include_router(profile.router)` after line 39.
  Run 1.4.1 to green. Run full backend suite
  (`mamba run -n contentspark pytest backend/tests`) — must stay at
  24 + new tests, all green.
- **1.4.3** [x] [VERIFY] `ruff check backend/` reports no new findings on the
  four touched/created files (`profile_service.py`, `routers/profile.py`,
  `schemas/profile.py`, `models/profile.py`, `main.py`, `conftest.py`,
  `test_profile.py`, `test_profile_service.py`). Pre-existing 52 findings are
  untouched debt — do not fix them here.

**Slice 1 exit criteria**: `pytest backend/tests` green; `ruff check
backend/` clean on new files; no file under `backend/alembic/versions/`
added; manual confirmation that `GET /api/profile/status` for a fresh user
returns `is_complete: false` with all 4 missing fields (via the test suite,
since live smoke-testing is blocked per proposal Dependencies).

---

## Phase 2 — Frontend: onboarding wizard (Slice 2)

Depends on Phase 1 (contract frozen: endpoint shapes, `ProfileStatus`,
string frequencies, `REQUIRED_PROFILE_FIELDS`). Delivers independently: a
user can create a profile end to end via `/onboarding` (reachable by direct
URL; the routing guard that sends users there is Phase 3).

### 2.1 `profile-api.ts` data layer [x]
- **2.1.1** [x] [RED] Create `frontend/features/profile/services/profile-api.test.ts`
  with failing tests (mirror `chats-api.ts` consumers' `vi.spyOn` pattern
  used in `chatSessionsStore.test.ts`) asserting: `getProfile()` calls
  `apiFetch("/api/profile", {method: "GET"})` and returns parsed JSON;
  `updateProfile(partial)` calls `PUT` with the given body;
  `submitOnboarding(payload)` calls `POST /api/profile/onboarding`;
  `getProfileStatus()` calls `GET /api/profile/status`; each throws
  `ApiError` on non-ok response (mirror `ensureOk` behavior).
  Spec: creator-profile / all requirements (client contract only).
- **2.1.2** [x] [GREEN] Create `frontend/features/profile/services/profile-api.ts`
  mirroring `frontend/features/chat/services/chats-api.ts`: `apiFetch` +
  local `ensureOk`, plus TS interfaces `ProfileStatus`, `Profile`,
  `SocialAccount`, `ProfileOnboardingInput`, `ProfileUpdateInput` matching
  design's frozen contract (`current_frequency`/`desired_frequency` typed
  `string | null`). Run 2.1.1 to green.

### 2.2 `profileStore.ts` (Zustand) [x]
- **2.2.1** [x] [RED] Create `frontend/features/profile/store/profileStore.test.ts`
  with failing tests (mirror `chatSessionsStore.test.ts`'s
  `vi.spyOn(profileApi, 'getProfile')` + `useProfileStore.getState()`
  pattern): `load()` sets `isLoading` true then false and populates
  `profile`; `load()` failure sets `error` and leaves `isLoading` false;
  `save(partial)` calls `updateProfile` and refreshes `profile` on success.
- **2.2.2** [x] [GREEN] Create `frontend/features/profile/store/profileStore.ts`:
  Zustand store with `profile: Profile | null`, `isLoading: boolean`,
  `error: string | null`, `load()`, `save(partial)`. Run 2.2.1 to green.

### 2.3 Onboarding wizard hook (draft state) [x]
- **2.3.1** [x] [RED] Create
  `frontend/features/onboarding/hooks/useOnboardingWizard.test.tsx` with
  failing tests: step navigation blocks advancing past a step whose
  required field (per design D7, four required fields are distributed
  across steps 1-4) is empty; `FREQUENCY_RECOMMENDATIONS[niche]` is exposed
  as a suggestion once `niche` is set, without forcing a value; final-step
  submit calls `submitOnboarding` exactly once with all collected draft
  fields.
  Spec: creator-onboarding / Multi-Step Wizard Form, Frequency Recommendation
  Fallback.
- **2.3.2** [x] [GREEN] Create
  `frontend/features/onboarding/hooks/useOnboardingWizard.ts`: local
  `useState` draft object (design D7 — not global/Zustand), step index,
  `next()`/`back()` with per-step required-field validation, `submit()`
  calling `profile-api.ts`'s `submitOnboarding`. Run 2.3.1 to green.

### 2.4 Wizard components
- **2.4.1** [RED] Create
  `frontend/features/onboarding/components/OnboardingWizard.test.tsx` with
  failing tests using `@testing-library/react` + mocked `profile-api`
  module: renders step 1 first; "Next" disabled/blocked when required field
  empty; renders all 4-5 steps in sequence; final submit triggers
  `submitOnboarding` once and (via router mock) navigates to `/chat`.
  Spec: creator-onboarding / Multi-Step Wizard Form scenarios.
- **2.4.2** [GREEN] Create wizard components (glassmorphism:
  `bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl`, Inter):
  `frontend/features/onboarding/components/OnboardingWizard.tsx`,
  `Step1Niche.tsx` (niche + sub_niche), `Step2Goals.tsx` (primary_goal,
  tone, target_audience), `Step3Frequency.tsx` (current/desired frequency
  with recommendation display), `Step4Formats.tsx` (preferred_formats +
  optional social accounts), `WizardProgress.tsx`. Run 2.4.1 to green.

### 2.5 Wire the onboarding page
- **2.5.1** [RED] Add/extend a test (e.g.
  `frontend/app/(app)/onboarding/page.test.tsx` if a page-test convention
  exists in this repo, otherwise fold into 2.4.1's component test by
  importing the page directly) asserting the page renders
  `OnboardingWizard` rather than the current 8-line stub content.
- **2.5.2** [GREEN] Replace the stub in
  `frontend/app/(app)/onboarding/page.tsx` to render `OnboardingWizard`.
  Run full frontend suite (`pnpm --dir frontend test`) — must stay green.

**Slice 2 exit criteria**: a user visiting `/onboarding` directly can
complete the wizard and `POST /api/profile/onboarding` persists all fields;
frontend suite green; no change to `frontend/proxy.ts` in this phase (guard
re-sourcing is Phase 3).

---

## Phase 3 — Frontend: profile view/edit + guard re-sourcing (Slice 3)

Depends on Phase 1 (API) and Phase 2 (wizard exists as the guard's
destination). Delivers independently: profile editing, plus enforced
first-run routing. Between the end of Phase 2 and the start of Phase 3 the
app is in today's behavior (no onboarding redirect) — a safe intermediate
state, not a regression.

### 3.1 Profile view/edit components
- **3.1.1** [RED] Create
  `frontend/features/profile/components/ProfileForm.test.tsx` with failing
  tests (mocked `profile-api`, `@testing-library/react`): renders current
  profile values; editing and submitting calls `profileStore.save` with
  only changed fields; shows `error` state from the store on failure.
  Spec: creator-profile / Profile Creation and Update, Partial update
  preserves other fields (frontend does not resend unchanged fields either,
  consistent with the backend contract).
- **3.1.2** [GREEN] Create `frontend/features/profile/components/ProfileView.tsx`
  and `ProfileForm.tsx` (glassmorphism, Inter), consuming `profileStore`.
  Run 3.1.1 to green.

### 3.2 Wire the profile page
- **3.2.1** [RED] Extend/add a test asserting
  `frontend/app/(app)/profile/page.tsx` renders `ProfileView` instead of its
  current 8-line stub.
- **3.2.2** [GREEN] Replace the stub in
  `frontend/app/(app)/profile/page.tsx` to render `ProfileView`. Run
  frontend suite — must stay green.

### 3.3 `profile-status.ts` — server-side status fetch
- **3.3.1** [RED] Create `frontend/shared/lib/profile-status.test.ts` with
  failing tests: `fetchProfileStatus(accessToken)` returns `true` when
  backend responds `{is_complete: true}`; returns `false` when
  `{is_complete: false}`; returns `null` (fail-open, design D2) on non-200,
  network error, or timeout — never throws.
- **3.3.2** [GREEN] Create `frontend/shared/lib/profile-status.ts`:
  `fetchProfileStatus(accessToken: string): Promise<boolean | null>`
  calling `GET {BACKEND_URL}/api/profile/status` with the bearer token,
  catching all failure modes into `null`. Run 3.3.1 to green.

### 3.4 Re-source `proxy.ts` — the 8-case threat matrix
- **3.4.1** [RED] Create `frontend/proxy.test.ts` with 8 failing tests
  (call `proxy(new NextRequest(url))` with mocked `createServerClient` and
  mocked `fetch`, per design's Threat Matrix — carry these case names
  verbatim):
  1. `returns next() for /onboarding when incomplete` — no redirect
     (self-exemption; the top redirect-loop risk).
  2. `redirects /chat → /onboarding when incomplete` — 307.
  3. `redirects /onboarding → /chat when complete` — 307.
  4. `never redirects a complete profile` — `/chat` with complete profile,
     no redirect.
  5. `does not fetch status when unauthenticated` — 307 to `/login`, and
     assert the status fetch was never called.
  6. `fails open on backend error` — status fetch rejects/non-200/times
     out → no onboarding redirect (design D2).
  7. `keeps /calendar bypass` — `/calendar` with incomplete profile → no
     redirect (`allowWithoutOnboarding`, proxy.ts:61, unchanged).
  8. `does not fetch status for a static asset path` — e.g.
     `/_next/static/x.js` is excluded by the matcher; assert no fetch.
  Spec: creator-onboarding / Completion-Based Routing, Onboarding Route
  Exemption, Successful Completion Exits the Wizard.
- **3.4.2** [GREEN] Edit `frontend/proxy.ts`: replace lines 47-53 (the
  `user_metadata`/`app_metadata` reads and the `onboardingCompleted`
  derivation) with a call to `fetchProfileStatus(accessToken)` from
  `shared/lib/profile-status.ts`, gated to run only when `user` is truthy
  and `isProtectedRoute` is true (design D3 — bounds latency to app
  navigations). Keep lines 55-88 (redirect logic, `/onboarding` exemption,
  `/calendar` bypass, reverse redirect, auth-route redirect) semantically
  unchanged, adapting only the `onboardingCompleted` variable's source.
  Do NOT touch `frontend/app/(app)/layout.tsx`. Run 3.4.1 to green. Run
  full frontend suite (`pnpm --dir frontend test`) — must stay green.

**Slice 3 exit criteria**: a user with an incomplete profile entering
`(app)` lands on `/onboarding`; a complete one is never redirected; all 8
threat-matrix cases pass; frontend suite green; `frontend/app/(app)/layout.tsx`
diff is empty.

---

## Final verification (all slices)

- **4.1** Run `mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test` — both green, counts at or above 24 + 19 plus all new tests.
- **4.2** Run `ruff check backend/` — no new findings beyond the documented 52.
- **4.3** Run `pnpm --dir frontend lint` and `pnpm --dir frontend exec tsc --noEmit` — clean.
- **4.4** Confirm `git status backend/alembic/versions/` shows no new file.
- **4.5** Confirm `git diff frontend/app/(app)/layout.tsx` is empty.

---

## Optional cleanup (separate from the three slices — accept or defer)

Not required by any spec requirement; purely dead-reference removal tied to
the dropped `users.onboarding_completed` column. Proposed as its own
follow-up task so it can be deferred without blocking slices 1-3.

- **C.1** Remove `onboardingCompleted: boolean` from
  `frontend/shared/types/index.ts:6` (the `User` type) — currently unused by
  any consumer after this change lands. ~1 line changed, plus updating any
  object literals that set it (none expected — grep found no writers).
- **C.2** Remove the `onboarding_completed` column from
  `frontend/prisma/schema.prisma:20`. Note: `prisma` is not a dependency in
  `frontend/package.json` (confirmed), so this file is an orphan — no
  `prisma generate`/migration tooling runs against it. ~1 line changed.
  Estimated total for C.1 + C.2: **~5-10 changed lines**, zero risk (no
  runtime code path exercises either file today).

---

## Review Workload Forecast

| Slice | Files (new/modified) | Estimated changed lines |
|---|---|---|
| 1 — Backend API | `models/profile.py` (1), `schemas/profile.py` (~35), `services/profile_service.py` (new, ~110), `routers/profile.py` (new, ~70), `main.py` (2), `tests/test_profile.py` (new, ~140), `tests/test_profile_service.py` (new, ~50), `tests/conftest.py` (+~20) | **~430** |
| 2 — Onboarding wizard | `profile-api.ts` (new, ~60) + test (~50), `profileStore.ts` (new, ~40) + test (~40), `useOnboardingWizard.ts` (new, ~90) + test (~70), 6 wizard components (new, ~260 total), `onboarding/page.tsx` (~10) | **~620** |
| 3 — Profile view/edit + guard | `ProfileView.tsx`/`ProfileForm.tsx` (new, ~150) + test (~70), `profile/page.tsx` (~10), `profile-status.ts` (new, ~30) + test (~40), `proxy.ts` (~15 changed lines net), `proxy.test.ts` (new, ~180) | **~495** |
| Optional cleanup | `shared/types/index.ts`, `prisma/schema.prisma` | **~5-10** |
| **Total (3 slices, excl. cleanup)** | | **~1545** |

`400-line budget risk: High`

Each slice individually still exceeds the 400-line budget (slice 1 ~430,
slice 2 ~620, slice 3 ~495). The proposal's own forecast (~1000-1500 lines)
undersold slice 2 and 3 specifically because the wizard needs 4-5 discrete
step components plus their tests, and the guard's 8-case threat matrix
alone is ~180 lines of test code. Re-estimating now that the guard shrank to
a ~15-line re-source does **not** bring any slice under budget — the wizard
step components dominate slice 2, and the threat-matrix tests dominate
slice 3's line count, not the guard edit itself.

`Chained PRs recommended: Yes`

Recommend splitting further within each slice's own sub-phases (already
numbered 1.1-1.4, 2.1-2.5, 3.1-3.4 above) as chain links, since each
sub-phase is a coherent RED→GREEN unit with a clear own line count
(roughly 60-180 lines per sub-phase). This keeps every individual PR/review
unit under the 400-line budget while preserving the three-slice dependency
order (1 → 2 → 3) for functional delivery milestones.

`Decision needed before apply: Yes`

The user must confirm before `sdd-apply`: (a) accept chaining within each
slice per the sub-phase boundaries above (recommended), or (b) accept
slices 1-3 as three individually over-budget PRs and review them as such,
or (c) propose a different split. `chain_strategy` has not yet been
collected by the orchestrator and should be resolved together with this
choice.

**Proposed slice boundaries and dependency order** (unchanged from the
proposal/design, confirmed still correct after re-estimation):

1. **Slice 1 — Backend API** (Phase 1, tasks 1.1-1.4): no dependency. Delivers
   a tested, standalone `/api/profile` surface (verifiable via pytest;
   `curl` blocked by the pre-existing Qdrant boot issue, out of scope).
2. **Slice 2 — Onboarding wizard** (Phase 2, tasks 2.1-2.5): depends on
   Slice 1's frozen contract. Delivers an end-to-end profile-creation path
   reachable by direct URL to `/onboarding`.
3. **Slice 3 — Profile view/edit + guard** (Phase 3, tasks 3.1-3.4): depends
   on Slices 1 and 2 (the guard's destination must exist first). Delivers
   editing plus enforced first-run routing.

---

## Task-to-spec traceability

| Task(s) | Spec requirement |
|---|---|
| 1.2, 1.3, 1.4 | creator-profile / Profile Read, Profile Creation and Update, Input Validation |
| 1.3.1, 1.3.2, 1.4.1 | creator-profile / Completion Status Contract |
| 1.4 (social account payload) | creator-profile / Social Accounts as Part of Profile |
| 1.4 (401 tests, `Depends(get_current_user)`) | creator-profile / Authorization and Ownership |
| 2.3, 2.4 | creator-onboarding / Multi-Step Wizard Form |
| 2.3 (recommendation display) | creator-onboarding / Frequency Recommendation Fallback |
| 3.3, 3.4 | creator-onboarding / Completion-Based Routing, Onboarding Route Exemption, Successful Completion Exits the Wizard |

## Parallelization notes

- Within Phase 1: 1.1 and 1.2 can run in parallel (independent files); 1.3
  depends on 1.2 (schema shapes); 1.4 depends on 1.3 (service methods).
- Phase 2 sub-tasks 2.1 → 2.2 → 2.3 → 2.4 → 2.5 are sequential (each layer
  consumes the previous one's exports), but 2.1 and later frontend work
  cannot start meaningfully before Phase 1 is merged (contract freeze).
- Phase 3: 3.1-3.2 (profile view) and 3.3-3.4 (guard) are independent of
  each other and could run in parallel once Phase 2 is merged, provided both
  land before Slice 3's exit criteria are checked together.
- No task in this list may run before its phase's dependency is merged;
  there is no cross-phase parallelism given the frozen-contract sequencing
  in the design.
