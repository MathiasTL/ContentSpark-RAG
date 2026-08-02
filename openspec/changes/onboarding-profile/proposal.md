# Proposal: Creator Onboarding and Profile

**Modules affected**: backend (FastAPI) **and** frontend (Next.js features).

## Intent

New users reach `/chat` with an empty `creator_profiles` row, so the CRAG prompt
personalizes on nothing and the upcoming calendar agent has no inputs. There is
no way to capture a creator profile: `backend/app/routers/profile.py` is a 2-line
stub that `backend/main.py` never registers, and
`frontend/features/onboarding/` and `frontend/features/profile/` are empty.

Success: a new user completes a short wizard once, lands in the app with a
personalized profile, can edit it later, and the calendar work that follows has a
guaranteed non-empty input contract.

## Scope

### In Scope
- Fix `backend/app/schemas/profile.py:21-22` (`current_frequency` /
  `desired_frequency` typed `int`, but `backend/app/models/profile.py:30-31` are
  `String(50)`) → `str`.
- New `backend/app/services/profile_service.py` + real
  `backend/app/routers/profile.py` (`GET`/`PUT /api/profile`,
  `POST /api/profile/onboarding`, `GET /api/profile/status`), registered in
  `backend/main.py`.
- `backend/tests/test_profile.py` (TDD, router + service).
- `frontend/features/onboarding/` — 4-5 step wizard form.
- `frontend/features/profile/` — view/edit.
- A narrow completion guard: incomplete profile inside `(app)` → `/onboarding`.

### Out of Scope
- Any Alembic migration. The columns already exist.
- Conversational onboarding. `backend/app/agents/onboarding_agent.py` stays a stub.
- General auth guard / `middleware.ts` (Fase 1).
- Calendar generation (`calendar-agent`, `calendar-api`).
- n8n and Google Calendar sync (post-launch).
- Fixing the Qdrant boot blocker (see Dependencies).

## Capabilities

### New Capabilities
- `creator-profile`: profile read/update API, the derived completion contract, and
  nested social accounts.
- `creator-onboarding`: first-run wizard flow and completion-based routing.

### Modified Capabilities
- None. `openspec/specs/` is currently empty.

## Approach

**Completion is derived, never stored.** `users.onboarding_completed` was dropped
by migration `e7f16d584e97` and is not coming back: a stored flag can drift from
the data it claims to describe, while a derived one cannot.

Required-field contract — a profile is complete when **all four** are non-empty:

| Field | Why required |
|-------|--------------|
| `niche` | Only field with a closed constant set (`NICHES`); drives retrieval and `FREQUENCY_RECOMMENDATIONS`. |
| `primary_goal` | Without it, generated content has no objective. |
| `tone` | Directly shapes every LLM prompt. |
| `target_audience` | Without it, output is generic. |

Excluded deliberately: `display_name` and `bio` (identity/cosmetic),
`sub_niche` (refinement), `preferred_formats` and `social_accounts` (optional),
`current_frequency` / `desired_frequency` (`FREQUENCY_RECOMMENDATIONS[niche]`
supplies a usable default). Requiring more fields lengthens the wizard without
improving personalization.

The contract is exposed by `GET /api/profile/status` returning
`{ is_complete: bool, missing_fields: string[] }`, computed in one place in
`profile_service.py`. The frontend never re-implements the rule.

Backend follows `backend/app/routers/chats.py`: thin router, singleton service
taking `(db, user_id, ...)`, `Depends(get_current_user)` / `Depends(get_db)`,
`flush()` + `refresh()` (not `commit()`), `HTTPException(404)` via
`scalar_one_or_none()`. `get_current_user` already lazily upserts the `users` row,
so the service may assume it exists. Frontend follows `frontend/features/chat/`:
`services/profile-api.ts` over `shared/lib/api-fetch.ts`, a Zustand store, and
`vi.spyOn` + `getState()` tests. `primary_goal`, `tone`, and `target_audience` are
free-text inputs — no constants exist for them.

## Recommended delivery split (recommendation, not settled)

Forecast is ~1000-1500 changed lines against a 400-line budget →
**400-line budget risk: High**. Confirm the final split with the user after
`sdd-tasks`.

| # | Slice | Delivers independently | Depends on |
|---|-------|------------------------|------------|
| 1 | Backend: schema fix, `profile_service.py`, `routers/profile.py`, `main.py` registration, `test_profile.py` | A working, tested profile API | — |
| 2 | Frontend: onboarding wizard + tests | A user can create a profile end to end | 1 |
| 3 | Frontend: profile view/edit + completion guard + tests | Editing, plus enforced first-run routing | 1, 2 |

Slice 3 carries the guard because the guard's only useful destination is a wizard
that already exists.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/schemas/profile.py` | Modified | `int` → `str` fix; add status schema |
| `backend/app/services/profile_service.py` | New | CRUD + completion rule |
| `backend/app/routers/profile.py` | Modified | Replace 2-line stub |
| `backend/main.py` | Modified | `app.include_router(profile.router)` |
| `backend/tests/test_profile.py` | New | Router + service tests |
| `backend/app/models/profile.py` | Unchanged | Reference only; no migration |
| `frontend/features/onboarding/` | New | Wizard |
| `frontend/features/profile/` | New | View/edit |
| `frontend/app/(app)/onboarding/page.tsx`, `.../profile/page.tsx` | Modified | Replace 8-line stubs |
| `frontend/app/(app)/layout.tsx` | Modified | Completion guard only |
| `frontend/shared/constants/index.ts` | Unchanged | Reuse `NICHES`, `FORMATS`, `PLATFORMS` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Completion guard sprawls into general auth-guard work | Med | Guard checks completion only; unauthenticated 401s stay with `handleAuthError` in `api-fetch.ts` |
| Guard causes a redirect loop on `/onboarding` itself | Med | Exempt the `/onboarding` route explicitly; cover with a test |
| Required-field set proves too narrow for the calendar agent | Med | Rule lives in one service function and is spec'd; widening is a small, testable change |
| Cannot manually smoke-test against a live server | High | `conftest.py` `sys.modules` stubbing keeps tests green; accept no manual curl until the Qdrant blocker is fixed |
| `preferred_formats` typed `Mapped[dict \| None]` but used as a list | Low | JSONB stores either; note it, do not change the column |
| Frontend slices still exceed 400 lines | Med | `sdd-tasks` forecasts; split further if needed |

## Rollback Plan

- **Slice 1**: revert the commit. Removing `app.include_router(profile.router)`
  from `backend/main.py` disables every new endpoint immediately. No migration
  ran, so there is no DB state to undo and no data loss.
- **Slices 2-3**: revert the commit. The pages return to their placeholder stubs
  and `(app)/layout.tsx` returns to no-redirect behavior; the backend API stays
  live and harmless.
- No destructive operation exists anywhere in this change.

## Dependencies

- `backend/app/services/qdrant_services.py:37` calls `collection_exists()` in
  `__init__` on a module-level singleton, so `uvicorn main:app` does not boot
  (configured endpoint returns HTTP 404: dead credentials **and** network I/O at
  import time). Out of scope, but it blocks manual smoke-testing.
- Prerequisite for `calendar-agent`, then `calendar-api`.
- Lint: new code must pass `ruff==0.16.1` (`backend/ruff.toml`). The 52
  pre-existing findings are documented debt.

## Success Criteria

- [ ] `mamba run -n contentspark pytest backend/tests` and
      `pnpm --dir frontend test` are green (currently 24 + 19).
- [ ] `GET /api/profile/status` returns `is_complete: false` with all four
      `missing_fields` for a new user, and `true` after the wizard.
- [ ] `POST /api/profile/onboarding` persists all wizard fields, including
      string frequencies like `"3 por semana"`.
- [ ] Every new endpoint returns 401 without a token and filters by `user_id`.
- [ ] A user with an incomplete profile entering `(app)` lands on `/onboarding`;
      a complete one is never redirected.
- [ ] `ruff check backend/` reports no new findings.
- [ ] No file under `backend/alembic/versions/` is added.
