# Design: Creator Onboarding and Profile

References: `CONTENTSPARK_SAAS_PROJECT.md` (data model, Fase 2 modules),
`CONTENTSPARK_SAAS_ROADMAP.md` (Fase 2 = onboarding + profile).

## Correction to the input assumptions (verified)

Two "confirmed facts" handed to this phase are **false** and change the design:

1. **A route guard already exists.** `frontend/proxy.ts` (95 lines) is the Next.js 16
   middleware — Next 16 renamed `middleware.ts` → `proxy.ts` with an exported
   `proxy(request)`. It already does Supabase cookie refresh (`createServerClient`),
   unauthenticated protection over `["/chat", "/onboarding", "/calendar", "/profile"]`
   (lines 38-59), an `/onboarding` self-exemption (line 45, 65-67), and the reverse
   redirect complete→`/chat` (lines 74-78).
2. **`frontend/shared/lib/supabase-server.ts` exists** (`createServerSupabaseClient()`
   with a `cookies()` adapter), so server-side session access is already available.

The onboarding half of that guard is **dead code today**: it reads
`user_metadata.onboarding_completed` (proxy.ts:48-51) and nothing in the repository
ever writes that key (verified by grep across `backend/`, `frontend/`), so
`onboardingCompleted` is always `null` and both onboarding branches never fire.

This change therefore does **not** build a guard. It **re-sources** the existing one.

## Technical Approach

Three layers, one rule.

1. **Backend** owns the completion rule in `profile_service.py` as the single
   `REQUIRED_FIELDS` tuple + one pure function. It is exposed over
   `GET /api/profile/status`. Nothing else — backend or frontend — restates it.
2. **Frontend data layer** is one `profile-api.ts` per the `chats-api.ts` shape
   (`apiFetch` + `ensureOk`), plus one Zustand store, per `features/chat/`.
3. **Routing** stays exactly where it already is: `frontend/proxy.ts`. Its
   `onboardingCompleted` expression is replaced by a fetch of the backend status
   endpoint. The redirect logic, the `/onboarding` exemption, and the reverse
   redirect are kept unchanged.

## Architecture Decisions

### D1 — Where the completion guard lives

| Option | Tradeoff | Verdict |
|---|---|---|
| **Re-source existing `proxy.ts`** | Reuses tested redirect + exemption logic; one network hop per protected navigation; runs before render so no flash of wrong UI | **Chosen** |
| Server component in `(app)/layout.tsx` | No middleware edit, but duplicates the redirect and cannot cover `/onboarding` reverse-redirect without a second check; layout would need `redirect()` on every render anyway | Rejected |
| Client-side check in a hook | Flash of protected UI before redirect; guard bypassable; contradicts existing proxy ownership | Rejected |

Rationale: a guard already exists and is the project's stated auth boundary
(`docs/superpowers/specs/2026-05-15-auth-completion-design.md:34`, "`proxy.ts`
intercepta requests… No se modifica"). Adding a second guard elsewhere creates the
exact dual-source drift the proposal's derived-completion decision was meant to kill.
The one deviation from that doc is deliberate and scoped: its chosen source
(`user_metadata`) was never implemented, so it is replaced, not duplicated.

### D2 — Fail-open on status-fetch failure

If `GET /api/profile/status` errors, times out, or returns non-200, `proxy.ts`
treats completion as `null` and performs **no onboarding redirect** (auth redirect
still applies). Rationale: this is exactly today's behavior, so a backend outage
degrades to the current state instead of trapping every user in `/onboarding`.
A 401 from the status call is not special-cased — the unauthenticated branch
(proxy.ts:55) already ran and passed.

### D3 — Status call scope

The fetch runs only when `user` is truthy **and** the path is in
`protectedPrefixes`. Static assets are already excluded by the matcher
(proxy.ts:91-94), and `/calendar` keeps its `allowWithoutOnboarding` bypass
(proxy.ts:61) but still needs no status call. Rationale: bounds the added latency
to app navigations, one indexed `SELECT ... WHERE user_id = ?`.

### D4 — Completion rule shape

`REQUIRED_PROFILE_FIELDS = ("niche", "primary_goal", "tone", "target_audience")`
plus `_missing_fields(profile) -> list[str]` treating `None` and whitespace-only
strings as missing. `is_complete = not missing_fields`. A `None` profile row yields
all four missing. Rationale: one tuple is the only thing to edit when the calendar
agent needs a wider contract; the whitespace rule prevents `" "` passing the wizard.

### D5 — Upsert semantics for the profile row

`get_or_create_profile(db, user_id)` returns the existing row or inserts an empty
one. `get_current_user` already guarantees the `users` row
(`backend/app/dependencies.py:35-44`), so the FK is safe. `GET /api/profile`
returns the (possibly empty) profile rather than 404 — a 404 would force the
frontend to distinguish "no profile" from "not found", which is not a real
distinction here. `PUT` and `POST /onboarding` both go through the same upsert.

### D6 — `preferred_formats` typing

`backend/app/models/profile.py:32` annotates `Mapped[dict | None]` over a JSONB
column while the Pydantic layer uses `list[str]`. JSONB stores either; only the
Python type hint is wrong. Fix the annotation to `Mapped[list[str] | None]`.
No migration, no runtime change. Recorded here so `sdd-apply` does not "fix" it
by changing the column.

### D7 — Wizard state is local, not global

The 4-step wizard holds draft answers in one `useState` object inside the wizard
container and submits once at the final step. The Zustand store holds only the
persisted profile + `isLoading`/`error`. Rationale: a partially-filled draft is not
application state; the `requestVersion` race guard used by the chat store is
overkill here (exploration §7).

## Data Flow

```
                     ┌── frontend/proxy.ts (Next 16 middleware) ──┐
  browser request ──▶│ supabase.auth.getUser() (cookies)          │
                     │ if !user && protected      → /login        │
                     │ GET /api/profile/status  ──────────────┐   │
                     │ if incomplete && !/onboarding → /onboarding │
                     │ if complete   &&  /onboarding → /chat     │
                     └───────────────────────────────────────────┘
                                                             │
  features/onboarding/ ─┐                                    ▼
  features/profile/    ─┴─▶ profile-api.ts ─▶ apiFetch ─▶ routers/profile.py
                                (JWT hdr)                      │
                                                 profile_service.py (RULE)
                                                               │
                                                creator_profiles + social_accounts
```

## Sequence: first-run redirect and wizard completion

```
Browser        proxy.ts        Backend /api/profile      profile_service      DB
   │ GET /chat     │                    │                       │             │
   ├──────────────▶│                    │                       │             │
   │               │ getUser() ✓        │                       │             │
   │               │ GET /status ──────▶│ get_status(db,uid) ───▶│ SELECT ────▶│
   │               │                    │                       │◀── row/None │
   │               │◀─ {is_complete:false, missing:[4]} ─────────┤             │
   │◀─ 307 /onboarding                  │                       │             │
   │ GET /onboarding                    │                       │             │
   ├──────────────▶│ (isOnboardingRoute → no redirect)          │             │
   │◀─ wizard (steps 1..4, local draft state)                   │             │
   │ POST /api/profile/onboarding ─────▶│ upsert_profile ──────▶│ UPSERT ────▶│
   │◀─ 200 ProfileResponse              │                       │             │
   │ router.replace("/chat")            │                       │             │
   ├──────────────▶│ GET /status ──────▶│ ─────────────────────▶│ SELECT ────▶│
   │               │◀─ {is_complete:true, missing:[]}           │             │
   │◀─ /chat renders                    │                       │             │
```

Note the client navigates to `/chat` itself after a 200; the proxy check on that
navigation is confirmation, not the mechanism, so a stale read cannot strand the user.

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/app/schemas/profile.py` | Modify | `current_frequency`/`desired_frequency` `int`→`str` (lines 21-22, 35-36); add `ProfileStatusResponse`; make `ProfileCreate` fields optional except the four required; `ProfileResponse` gets `model_config = ConfigDict(from_attributes=True)` |
| `backend/app/services/profile_service.py` | Create | `REQUIRED_PROFILE_FIELDS`, `_missing_fields`, `get_or_create_profile`, `get_status`, `update_profile`, `complete_onboarding`, `_replace_social_accounts`; singleton `profile_service` |
| `backend/app/routers/profile.py` | Modify | Replace 2-line stub: `APIRouter(prefix="/api/profile", tags=["profile"])`, 4 thin handlers + `_to_profile_response` |
| `backend/main.py` | Modify | Add `profile` to the line-8 import and `app.include_router(profile.router)` after line 39 |
| `backend/app/models/profile.py` | Modify | Line 32 annotation only: `Mapped[dict \| None]` → `Mapped[list[str] \| None]` |
| `backend/tests/test_profile.py` | Create | Router tests via `client` + `patch_profile_service` |
| `backend/tests/test_profile_service.py` | Create | Pure completion-rule tests |
| `backend/tests/conftest.py` | Modify | Add `patch_profile_service` fixture mirroring `patch_chat_service` (lines 115-133) |
| `frontend/features/profile/services/profile-api.ts` | Create | `getProfile`, `updateProfile`, `submitOnboarding`, `getProfileStatus` + TS interfaces |
| `frontend/features/profile/store/profileStore.ts` | Create | Zustand: `profile`, `isLoading`, `error`, `load`, `save` |
| `frontend/features/profile/components/` | Create | `ProfileView.tsx`, `ProfileForm.tsx` (glassmorphism) |
| `frontend/features/onboarding/components/` | Create | `OnboardingWizard.tsx` + `Step1Niche`…`Step4Formats`, `WizardProgress.tsx` |
| `frontend/features/onboarding/hooks/useOnboardingWizard.ts` | Create | Draft state, step nav, per-step validation, submit |
| `frontend/app/(app)/onboarding/page.tsx` | Modify | Replace 8-line stub → renders `OnboardingWizard` |
| `frontend/app/(app)/profile/page.tsx` | Modify | Replace 8-line stub → renders `ProfileView` |
| `frontend/proxy.ts` | Modify | Replace lines 47-53 metadata read with `fetchProfileStatus(request)`; keep lines 55-88 untouched |
| `frontend/shared/lib/profile-status.ts` | Create | Server-side `fetchProfileStatus(accessToken)` → `boolean \| null`, fail-open |
| `frontend/proxy.test.ts` | Create | Redirect-matrix tests (see Threat Matrix) |
| `frontend/app/(app)/layout.tsx` | **Unchanged** | Correction to the proposal (line 112): the guard lives in `proxy.ts`, so the layout needs no edit |
| `backend/alembic/versions/` | **None** | No migration. All columns exist. |
| `frontend/shared/constants/index.ts` | Unchanged | Reuse `NICHES`, `FORMATS`, `PLATFORMS`, `FREQUENCY_RECOMMENDATIONS` |

## Interfaces / Contracts (frozen by slice 1)

```python
# backend/app/services/profile_service.py
REQUIRED_PROFILE_FIELDS: tuple[str, ...] = (
    "niche", "primary_goal", "tone", "target_audience",
)

class ProfileService:
    async def get_or_create_profile(self, db, user_id: str) -> CreatorProfile: ...
    async def get_status(self, db, user_id: str) -> tuple[bool, list[str]]: ...
    async def update_profile(self, db, user_id: str, **fields) -> CreatorProfile: ...
    async def complete_onboarding(self, db, user_id: str, payload) -> CreatorProfile: ...

profile_service = ProfileService()
```

```
GET  /api/profile           200 ProfileResponse            401 no token
PUT  /api/profile           200 ProfileResponse   400 no fields   401
POST /api/profile/onboarding 200 ProfileResponse  422 bad payload 401
GET  /api/profile/status    200 {is_complete: bool, missing_fields: string[]}  401
```

```ts
// frontend/features/profile/services/profile-api.ts
export interface ProfileStatus { is_complete: boolean; missing_fields: string[] }
export interface Profile {
  id: string; user_id: string;
  display_name: string | null; bio: string | null;
  niche: string | null; sub_niche: string | null;
  primary_goal: string | null; tone: string | null; target_audience: string | null;
  current_frequency: string | null; desired_frequency: string | null;  // strings, not ints
  preferred_formats: string[]; social_accounts: SocialAccount[];
}
```

`current_frequency`/`desired_frequency` are **strings** (`"3 por semana"`), matching
`String(50)` at `backend/app/models/profile.py:30-31`. This is the contract detail
slices 2 and 3 must not re-derive.

## Delivery slices and their seams

| # | Slice | Delivers alone | Freezes for later slices |
|---|---|---|---|
| 1 | Backend: schema fix, `profile_service.py`, router, `main.py`, model annotation, tests | Tested profile API; verifiable by pytest + curl | The 4 endpoint shapes, `ProfileStatus`, string frequencies, `REQUIRED_PROFILE_FIELDS` |
| 2 | `features/onboarding/` wizard + `profile-api.ts` + `profileStore.ts` + tests; `/onboarding` page | A user creates a profile end to end (reachable by direct URL) | `profile-api.ts` function names/signatures and the store slice shape |
| 3 | `features/profile/` view/edit + `proxy.ts` re-source + `profile-status.ts` + `proxy.test.ts` | Editing, plus enforced first-run routing | — |

Slice 3 owns the guard because its only useful destination is a wizard that exists
after slice 2. Between slices 2 and 3 the app is in its **current** behavior (no
onboarding redirect), which is a safe intermediate state, not a regression.

## Testing Strategy

STRICT TDD is on. Named seams so RED tests can be written first:

| Layer | What to test | Approach |
|---|---|---|
| Unit (backend) | `_missing_fields` over: all-empty row, whitespace-only `tone`, all-four-present, `None` profile | Direct call with `SimpleNamespace` fakes — no DB, no client |
| Router (backend) | 200/400/422 shapes, `assert_awaited_once`, **one "no token → 401" test per endpoint** | `client` fixture + new `patch_profile_service` monkeypatch fixture in `conftest.py` |
| Serialization (backend) | `"3 por semana"` survives `POST /onboarding` round-trip | Router test asserting the echoed body |
| Store (frontend) | `load`/`save` set `isLoading`/`error`; failure path sets `error` | `vi.spyOn(profileApi, 'getProfile')` + `useProfileStore.getState()` |
| Component (frontend) | Step nav blocks on empty required field; final step calls `submitOnboarding` once | `@testing-library/react` + mocked api module |
| Routing (frontend) | Redirect matrix below | `proxy.test.ts` — call `proxy(new NextRequest(url))` with mocked `createServerClient` and mocked `fetch` |

`conftest.py` stubs `llm_services`/`embeddings_service`/`qdrant_services` into
`sys.modules` before `from main import app` (lines 32-55), so registering the profile
router in `main.py` does not reintroduce the Qdrant import-time blocker.

## Threat Matrix

The generic matrix rows target shell/VCS boundaries and are **N/A** here:

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file classification or execution |
| Git repository selection | N/A — no VCS automation |
| Commit state | N/A — no VCS automation |
| Push state | N/A — no VCS automation |
| PR commands | N/A — no subprocess or PR automation |

This change **does** cross an HTTP-routing boundary (`proxy.ts` redirects), so the
matrix is replaced by the routing cases below. Each row is a mandatory RED test in
`frontend/proxy.test.ts`; carry them into `tasks.md` unchanged.

| Case | Expected behavior | RED test |
|---|---|---|
| Incomplete profile requests `/onboarding` | No redirect (self-exemption) — a loop here is the top risk | `returns next() for /onboarding when incomplete` |
| Incomplete profile requests `/chat` | 307 → `/onboarding` | `redirects /chat → /onboarding when incomplete` |
| Complete profile requests `/onboarding` | 307 → `/chat` | `redirects /onboarding → /chat when complete` |
| Complete profile requests `/chat` | No redirect | `never redirects a complete profile` |
| Unauthenticated on any protected path | 307 → `/login`, **status endpoint never called** | `does not fetch status when unauthenticated` |
| Status fetch rejects / non-200 / times out | Fail open: no onboarding redirect | `fails open on backend error` |
| `/calendar` with incomplete profile | No redirect (`allowWithoutOnboarding`, proxy.ts:61) | `keeps /calendar bypass` |
| Static asset path | Matcher excludes it; no fetch | Covered by matcher; assert no fetch for `/_next/static/x.js` |

## Migration / Rollout

No migration. `backend/alembic/versions/` gains no file — this is a success
criterion, not a convention. Rollback is `git revert` per slice; removing
`app.include_router(profile.router)` disables the whole API surface instantly, and
reverting `proxy.ts` restores today's no-op onboarding branch. No destructive
operation exists anywhere in this change.

## Open Questions

- [ ] Latency of one `/api/profile/status` call per protected navigation is
      accepted as-is. If it proves visible, the follow-up is a short-TTL signed
      cookie written by the proxy — explicitly **out of scope** here, and it must
      stay a cache, never a second source of truth.
- [ ] `frontend/shared/types/index.ts:6` still declares `onboardingCompleted: boolean`
      on the `User` type and `frontend/prisma/schema.prisma:20` still has the dropped
      column. Both are unused dead references; flagged, not touched.
- [ ] Non-scoped observation: `backend/app/services/qdrant_services.py:37` performs
      network I/O at import time via a module-level singleton. Tests are immune
      (conftest stubbing) but it remains an availability risk for `uvicorn`.
