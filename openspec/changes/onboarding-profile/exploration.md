# Exploration: onboarding-profile

> Reconstructed from Engram `sdd/onboarding-profile/explore` (observation #5).
> The `sdd-explore` phase had no write tool, so this file was written during
> `sdd-propose` to complete the `hybrid` artifact store.

Scope explored: a multi-step wizard form that populates `CreatorProfile`.

## Current State

### 1. Models — `backend/app/models/profile.py` (64 lines)

`CreatorProfile` (table `creator_profiles`): `id: uuid` PK, `user_id: uuid`
FK → `users.id` CASCADE UNIQUE, `display_name` `String(255)`, `bio` `Text`,
`niche` `String(100)`, `sub_niche` `String(100)`, `primary_goal` `String(255)`,
`tone` `String(100)`, `target_audience` `Text`, `current_frequency` `String(50)`,
`desired_frequency` `String(50)`, `preferred_formats` `JSONB`. All nullable.
Created by migration `04bb76c6e29f` (lines 40-59), unchanged since.

`SocialAccount`: `id`, `profile_id` FK CASCADE, `platform`, `handle`, `url`,
`follower_count`, `added_at` (typed `String(50)`, not a timestamp — pre-existing
oddity, out of scope).

**Verdict: NO Alembic migration is required to store wizard fields.**

**Bug found**: `backend/app/schemas/profile.py:21-22` declares
`current_frequency: int` / `desired_frequency: int`, but the columns are
`String(50)`. Real type mismatch; fix the schema to `str`. No migration needed.

### 2. Onboarding-completion signal — genuine gap

Migration `04bb76c6e29f` created `users.onboarding_completed: bool` (line 32).
Migration `e7f16d584e97` (`drop_users_onboarding_completed.py`) drops it with no
replacement. `backend/app/models/user.py` (lines 10-31) has no completion flag.
Nothing in models, schemas, or frontend signals completion today.

Fork identified: (a) re-add a boolean column via migration, or (b) derive
completion from `creator_profiles` field completeness.

### 3. Router — `backend/app/routers/profile.py` is a 2-line stub

Verbatim: `# Fase 2: Endpoints de perfil del creador y onboarding` /
`# TODO Fase 2: Implementar GET/PUT /api/profile y POST /api/profile/onboarding`.

Not registered: `backend/main.py:8` imports only `auth, chat, chats, ingest`;
lines 36-39 register only those four.

### 4. Patterns to imitate — `backend/app/routers/chats.py` (103 lines), `auth.py`

- Router: `APIRouter(prefix="/api/x", tags=["x"])`, thin handlers with
  `user_id: str = Depends(get_current_user)` and `db: AsyncSession = Depends(get_db)`
  from `app.dependencies`; delegate to a module-level singleton service instance;
  map ORM → Pydantic via small `_to_*` helpers in the router file.
- Service (`backend/app/services/chat_service.py`): methods take `(db, user_id, ...)`,
  explicit `select(...).where(Model.user_id == uuid)`, `HTTPException(404)` when
  `scalar_one_or_none()` is `None`, `await db.flush()` + `await db.refresh(obj)`
  (never `commit()` — `get_db` commits). `_to_uuid(value, label)` raises
  `HTTPException(400)` on bad ids.
- Status codes: 201 create, 204 delete, 200 otherwise.
- `backend/app/dependencies.py` (57 lines): `get_current_user` verifies the token
  via `verify_supabase_token`, then `_lazy_upsert_user` does
  `INSERT ... ON CONFLICT DO NOTHING` on `users`. Profile logic may assume the
  `users` row exists.

### 5. Schemas — `backend/app/schemas/profile.py` is NOT a stub (41 lines)

Already has `SocialAccountCreate`, `ProfileCreate`, `ProfileUpdate`,
`ProfileResponse(ProfileCreate)`. Missing: any onboarding-status schema. Plus
the `int`/`str` bug above.

### 6. Frontend constants — `frontend/shared/constants/index.ts` (34 lines)

Exports exactly `NICHES`, `PLATFORMS`, `FORMATS`, `FREQUENCY_RECOMMENDATIONS`.
**No constants for `primary_goal`, `tone`, or `target_audience`** — those are
free-text inputs in the wizard.

### 7. Frontend patterns — `frontend/features/chat/`

- API layer: one function per verb in `services/x-api.ts` using `apiFetch` from
  `@/shared/lib/api-fetch`, plus an `ensureOk(response, action)` helper throwing
  `ApiError(status, message)`; exported TS interfaces mirror backend Pydantic shapes.
- `frontend/shared/lib/api-fetch.ts` (48 lines): attaches the JWT via
  `getAuthHeaders()` (`supabase.auth.getSession()`, client-side only), and
  `handleAuthError(response)` resets the chat store, signs out, and redirects to
  `/login` on 401. Reusable as-is; no changes needed.
- State: Zustand `create<T>()` per domain with async actions and an
  `isLoading` / `error: string | null` slice. The `requestVersion` race guard is
  overkill for a wizard.
- Tests: `vi.spyOn(apiModule, 'fn').mockResolvedValue(...)`, a `resetStore()`
  helper in `beforeEach`, assertions via `useXStore.getState()`.

### 8. Routing / guards — gap confirmed

`frontend/app/(app)/layout.tsx` (16 lines) renders `Background`, `AppSidebar`,
`SidebarShell` and performs **no auth check and no redirect**. No `middleware.ts`
exists anywhere under `frontend/`. `AppSidebar.tsx` calls
`supabase.auth.getUser()` only to render name/avatar. `onboarding/page.tsx` and
`profile/page.tsx` are 8-line placeholders. The completion redirect is net-new
work with no existing guard to extend.

### 9. Testing

- `backend/tests/conftest.py` (134 lines) sets dummy env vars (lines 12-19), then
  stubs `app.services.llm_services`, `app.services.embeddings_service`, and
  `app.services.qdrant_services` into `sys.modules` (lines 32-49) **before**
  `from main import app` (line 55). This neutralizes the Qdrant import-time
  blocker for any new test module. A new `test_profile.py` gets the working
  `client` fixture for free. Reusable fixtures: `mock_user_id`,
  `mock_supabase_user`, `mock_supabase_admin`, `mock_db_session`, `client`.
- Router tests (`test_chats.py`, 174 lines): fake ORM objects via `SimpleNamespace`,
  assert status codes, `patch_x_service.method.assert_awaited_once()`, and one
  "no token → 401" test per protected endpoint.
- Frontend `vitest.config.ts`: jsdom, `include: ['**/*.{test,spec}.{ts,tsx}']`,
  `@` alias → `frontend/`. No coverage config despite `openspec/config.yaml`
  claiming `coverage: true` (pre-existing gap, unrelated).

### 10. Size forecast vs the 400-line review budget

| Area | Estimate |
|------|----------|
| Backend (schema fix + service + router + `main.py` + tests) | 340-500 |
| Frontend onboarding wizard + tests | 350-580 |
| Frontend profile view/edit + guard + tests | 310-510 |
| **Combined** | **~1000-1500+** |

`400-line budget risk: High` (2.5-4x the budget).

## Affected Areas

| Path | Impact |
|------|--------|
| `backend/app/models/profile.py` | Read-only reference |
| `backend/app/schemas/profile.py` | Fix `int` → `str`; add status schema |
| `backend/app/services/profile_service.py` | New |
| `backend/app/routers/profile.py` | Replace stub |
| `backend/main.py` | Register router |
| `backend/tests/test_profile.py` | New |
| `frontend/features/onboarding/` | New (currently `index.ts` only) |
| `frontend/features/profile/` | New (currently `index.ts` only) |
| `frontend/app/(app)/onboarding/page.tsx`, `profile/page.tsx` | Replace stubs |
| `frontend/app/(app)/layout.tsx` | New completion guard |
| `frontend/shared/constants/index.ts` | Read-only reuse |

## Approaches

1. **Single combined change.** Pros: one coherent review; no intermediate state.
   Cons: 3-4x over budget; forces a stop-and-ask under `ask-on-risk`. Effort: High.
2. **2 slices (backend / frontend).** Pros: backend independently testable and
   mergeable. Cons: frontend slice alone still 650-1000+ lines. Effort: Med-High.
3. **3 slices (backend / wizard UI / profile UI).** Pros: each slice near budget;
   most reviewer-friendly. Cons: PR overhead and strict sequencing. Effort: Medium.

**Recommendation**: Approach 3, with the onboarding-completion-signal fork
resolved explicitly in `sdd-propose` / `sdd-design`.

## Risks

- Onboarding-completion signal is a genuine gap with no replacement — must be an
  explicit decision, not an assumption.
- `int` vs `String(50)` schema bug will cause validation surprises if unfixed.
- No frontend auth or onboarding guard exists at all; the redirect is net-new and
  risks sprawling into general auth-guard (Fase 1) territory.
- Review-budget risk is High; `sdd-tasks` must forecast chained PR slices.
- `profile.py` is not registered in `main.py` — easy to miss.
- The `import main` Qdrant-404 blocker does **not** affect testability here.

## Ready for Proposal

Yes — provided `sdd-propose` resolves the completion-signal fork and plans the
3-slice split.
