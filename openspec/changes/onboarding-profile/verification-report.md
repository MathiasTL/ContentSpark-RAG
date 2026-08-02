```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e121b5b2efde3433c2f728f091f2b657dccbff3b
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 17/23
test_command: mamba run -n contentspark pytest backend/tests && pnpm --dir frontend test
test_exit_code: 0
build_command: pnpm --dir frontend build
build_exit_code: 0
```

## Verification Report (RE-VERIFICATION after remediation)

**Change**: onboarding-profile
**Version**: N/A (delta specs, 2 new capabilities)
**Mode**: Strict TDD
**Prior verdict**: FAIL (1 CRITICAL, 6 WARNING) — see git history of this file / Engram `sdd/onboarding-profile/verify-report` for the prior revision text.
**This run**: re-verifies commits `36ce44b` (frontend dead-reference cleanup) and `e121b5b` (CRITICAL fix) on top of the previously-verified baseline.

### CRITICAL — closed, independently confirmed

**Prior finding**: `PUT /api/profile` (`ProfileUpdate` schema) had no `social_accounts` field, so Pydantic silently dropped any client-submitted accounts on update, violating spec `creator-profile` scenario "Social accounts submitted with profile update" (spec.md:113-117).

**Fix verified by direct code read, not by trusting the commit message**:
- `backend/app/schemas/profile.py:38-41` — `ProfileUpdate.social_accounts: list[SocialAccountCreate] | None = None` added. Confirmed via `git show e121b5b -- backend/app/schemas/profile.py`: this is the *only* production code change in the remediation commit. `git show e121b5b --stat` confirms `profile_service.py` and `routers/profile.py` are absent from the diff — matches the claim they were untouched.
- **Omit-vs-empty-list semantics traced end to end**, not assumed:
  - `routers/profile.py:39-41` calls `profile_service.update_profile(db, user_id, **payload.model_dump())`. This is a plain `model_dump()` with **no** `exclude_unset=True` — every field, set or not, is dumped. For an omitted `social_accounts`, the Pydantic default (`None`) is dumped, so `fields["social_accounts"] == None`. For an explicit `[]` in the request body, Pydantic validates and stores `[]`, and `model_dump()` dumps `[]` (not `None`). These two cases are genuinely distinguishable at this call site — the subtlety the task called out does not break the contract here, because the *only* two states of a `list[...] | None` field with no `exclude_unset` are "the literal default" and "whatever was validated from the request," and `None` and `[]` are never conflated by Pydantic's validation (an empty JSON array `[]` never coerces to `None`).
  - `profile_service.py:70` — `social_accounts = fields.pop("social_accounts", None)` extracts the value **before** the generic per-field loop runs, so the generic `if value is not None and hasattr(profile, key): setattr(...)` loop (line 72-74) never sees or touches `social_accounts` — it cannot be double-handled or overwritten by the generic path.
  - `profile_service.py:75-76` — `if social_accounts is not None: await self._replace_social_accounts(...)`. Omitted (`None`) → skipped, existing rows untouched. `[]` (not `None`) → calls `_replace_social_accounts` with an empty list, which deletes all existing `SocialAccount` rows for the profile and adds none — a real clear, not a no-op.
  - **Verdict on the model_dump()-without-exclude_unset concern the orchestrator flagged**: it does NOT create a hazard in this code path, because (a) the field's own default is `None`, matching the semantic the code wants for "not provided," and (b) the `fields.pop(..., None)` + explicit `is not None` guard is evaluated on the *value*, not on Pydantic's set/unset bookkeeping — so it is robust regardless of `exclude_unset`. This is a deliberate, correct use of a sentinel default rather than `exclude_unset`, and it works.
- **New tests read directly, not summarized from the commit message** (`git show e121b5b -- backend/tests/test_profile.py backend/tests/test_profile_service.py`):
  - `test_profile.py::test_put_profile_with_social_accounts_forwards_them` — asserts both the HTTP response body echoes the submitted account and that `update_profile` was called with `social_accounts=[{...}]` — a real behavioral assertion, not a tautology.
  - `test_profile.py::test_put_profile_omitting_social_accounts_leaves_them_untouched` — asserts `update_profile` is called with `social_accounts=None` when the field is omitted from the JSON body.
  - `test_profile.py::test_put_profile_empty_social_accounts_clears_them` — asserts `update_profile` is called with `social_accounts=[]` (distinct assertion object from the `None` case above — genuinely distinguishes the two).
  - `test_profile_service.py` — 3 new `ProfileUpdate` schema-level tests (`social_accounts` defaults to `None`; accepts an explicit list; accepts an explicit `[]`) plus 5 new `ProfileService` unit tests: accounts-present → `_replace_social_accounts` called with the accounts; accounts-omitted → `_replace_social_accounts` **not awaited** (`assert_not_awaited()`, a real negative assertion); `[]` → `_replace_social_accounts` awaited with `[]`; `get_or_create_profile` always scoped by the exact `user_id` argument; and a dedicated `_replace_social_accounts` test asserting the newly-created `SocialAccount` row's `profile_id` matches the resolved profile's `id`, not any other identifier.
  - All 11 assertions inspect either an HTTP response body, a mock call's kwargs, or an object attribute — none are `assert True`/no-op patterns.

**No wipe hazard found**: a partial update that mentions unrelated fields (e.g. `{"bio": "..."}`) but omits `social_accounts` cannot clear accounts, because the only path to `_replace_social_accounts` is `social_accounts is not None`, and the field's own default (used whenever it's absent from the request JSON) is `None`. Confirmed by `test_put_profile_omitting_social_accounts_leaves_them_untouched` and `test_update_profile_without_social_accounts_leaves_untouched` (service layer, `assert_not_awaited`).

**CRITICAL status: CLOSED.** Fix scope matched the diagnosis exactly (schema-only), no drive-by changes to `profile_service.py`/`routers/profile.py` as claimed and confirmed via diff, and the omit-vs-clear distinction is real, not asserted.

---

### Regression check — constraints re-verified after the remediation

| Constraint | Status | Evidence |
|---|---|---|
| Completion rule lives in exactly one place, server-side | ✅ Unchanged | `profile_service.py:13-39` (`REQUIRED_PROFILE_FIELDS`/`_missing_fields`) untouched by either remediation commit; `social_accounts` is explicitly excluded from the completion contract by design (spec.md:104) and the new field doesn't touch `_missing_fields`. |
| `user_id` scoping on every query | ✅ Unchanged, and now additionally test-covered | `routers/profile.py` diff is empty for this remediation (git show confirms). New test `test_update_profile_scopes_get_or_create_by_user_id` and `test_replace_social_accounts_scopes_new_rows_to_profile` add coverage that didn't exist before, strengthening (not weakening) this constraint. |
| No path/query user identifier anywhere | ✅ Unchanged | `routers/profile.py` untouched; still 0 endpoints accept a client-supplied identifier. |
| No redirect loop | ✅ Unchanged | `proxy.ts` untouched by both remediation commits (confirmed: neither commit's diff touches `frontend/proxy.ts`). |
| Fail-open on status-fetch failure | ✅ Unchanged | `profile-status.ts` untouched by both remediation commits. |
| Frontend cleanup introduced no dangling references | ✅ Confirmed | `rg -in "onboardingCompleted\|prisma" frontend/` (excluding node_modules/.next) returns only `frontend/proxy.ts`'s local variable `onboardingCompleted` (a function-scoped `let`, unrelated to the deleted `User.onboardingCompleted` type field). `frontend/prisma/` confirmed deleted (`ls` → no such file/directory). `tsc --noEmit` and `next build` both clean (see Gates below), which would have caught a dangling import. |

No second defect found in the remediation. The fix is narrowly scoped to the one file the diagnosis named, and the two supporting commits (schema fix + prior cleanup) do not touch any of the previously-verified invariants.

---

### Gates — run independently in this session, verbatim

**Backend tests** (`mamba run -n contentspark pytest backend/tests`):
```
collected 56 items
backend/tests/test_auth.py ....                                          [  7%]
backend/tests/test_chat.py .....                                         [ 16%]
backend/tests/test_chat_service.py ....                                  [ 23%]
backend/tests/test_chats.py ...........                                  [ 42%]
backend/tests/test_models_indexes.py ....                                [ 50%]
backend/tests/test_profile.py .............                              [ 73%]
backend/tests/test_profile_service.py ...............                    [100%]
======================== 56 passed, 1 warning in 0.16s =========================
```
Matches expected count (56 = 45 prior + 11 new).

**Frontend tests** (`pnpm --dir frontend test`):
```
 Test Files  9 passed (9)
      Tests  65 passed (65)
```
Matches expected count (unchanged — remediation was backend-only).

**TypeScript** (`pnpm --dir frontend exec tsc --noEmit`): exit 0, no output — clean.

**Lint** (`pnpm --dir frontend lint`): `✖ 5 problems (0 errors, 5 warnings)` — exact expected baseline (`coverage/block-navigation.js` gitignored generated output; `CalendarGrid.tsx`, `MobileNav.tsx`, `Footer.tsx`, `Navbar.tsx` pre-existing, unrelated to this change).

**Ruff** (`mamba run -n contentspark ruff check backend/`): `Found 52 errors.` — exact expected count, unchanged from the prior run (0 findings in any file touched by this change, confirmed by the absence of `profile.py`/`profile_service.py`/`test_profile*.py` in ruff's output).

**Alembic** (`cd backend && mamba run -n contentspark alembic check`): `No new upgrade operations detected.` exit 0 — the new `social_accounts` field on `ProfileUpdate` maps to the pre-existing `SocialAccount` table/model; no schema change, no migration required. Correct.

**Build** (`pnpm --dir frontend build`):
```
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 1744ms
  Running TypeScript ...
  Finished TypeScript in 1610ms ...
✓ Generating static pages using 9 workers (11/11) in 128ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /calendar
├ ○ /callback
├ ○ /chat
├ ƒ /chat/[id]
├ ○ /login
├ ○ /onboarding
├ ○ /profile
└ ○ /signup

ƒ Proxy (Middleware)
```
Matches expected — `ƒ Proxy (Middleware)` present, build succeeds, no dangling-import failures from the prisma/type cleanup.

All 7 requested gates pass at their expected counts.

---

### Prior WARNINGs — resolved/open/superseded

1. **Task/apply-progress drift on "Optional cleanup"** — **RESOLVED.** `tasks.md:331-335` now shows `C.1` as `[x]` with an explicit note: "Done in `36ce44b`: field removed from the shared `User` type." The Engram `apply-progress` record (obs #13, latest revision) explicitly corrects itself: *"Correction from prior revision: `Optional cleanup` (C.1/C.2) is NOT pending — it WAS done, in commit `36ce44b`... The prior revision of this record was wrong."* Both artifacts now agree with the commit history. Independently confirmed `frontend/prisma/` is deleted and `onboardingCompleted` is absent from `shared/types/index.ts`.

2. **Cross-user profile isolation has no dedicated test** — **STILL OPEN, unchanged.** The remediation added `test_update_profile_scopes_get_or_create_by_user_id` and `test_replace_social_accounts_scopes_new_rows_to_profile`, which strengthen scoping coverage for the *update* path specifically, but no test in the suite creates two distinct users and asserts one cannot read/write the other's profile end-to-end. Still structurally sound (confirmed again: no endpoint in `routers/profile.py` accepts a client-supplied identifier), still a real gap against the letter of the spec, still consistent with this repo's existing convention (`test_chats.py` has the same gap) — not a regression, not new.

3. **"Wrong-typed field rejected" scenario is untested** — **STILL OPEN, unchanged.** No new test added for this in the remediation; `rg` confirms the only `ValidationError` test in the suite is unrelated (line 28 of `test_profile_service.py`, from before this remediation). Runtime correctness previously verified by direct interpreter inspection, not retested here since nothing changed in this area.

4. **"Profile with only some required fields" (2-of-4 missing) scenario not reproduced exactly** — **STILL OPEN, unchanged.** No test touching `_missing_fields()` was added or modified in the remediation (only `ProfileUpdate`/`update_profile`/`_replace_social_accounts` tests were added). The underlying loop still generalizes correctly; the literal 2-of-4 scenario remains untested.

5. **`get_or_create_profile`'s upsert/dedup logic has no direct unit test against a fake session's select-then-insert branch** — **STILL OPEN, unchanged.** The new tests mock `get_or_create_profile` itself (`monkeypatch.setattr(service, "get_or_create_profile", AsyncMock(...))`) rather than exercising its internal `select`-then-insert-if-none branching, so this gap is untouched by the remediation. `unique=True` on `CreatorProfile.user_id` (`models/profile.py:20`) remains the hard backstop.

6. **GET `/api/profile`'s "existing profile is returned" scenario has no dedicated test** — **STILL OPEN, unchanged.** No GET-path test was added in the remediation (which only touched PUT/service tests). The populated-profile case is still only exercised indirectly via PUT's response body.

**Summary**: 1/6 resolved (record drift, closed by commit + corrected artifacts), 5/6 remain open exactly as before — all are pre-existing untested-scenario gaps unrelated to the remediation's scope, not new findings and not regressions.

---

### Follow-up assessed: `ProfileForm.tsx` has no social-account editing UI

**Question**: does this leave a spec requirement unimplemented, blocking archive?

**Answer: No — confirmed by reading both specs, not assumed.**
- `creator-profile` spec (spec.md:99-104): "The system MUST allow social accounts to be submitted together with profile creation/update input." This requirement is scoped to "the system" (the API contract), and the scenario at spec.md:113-117 says "the user submits an update including one or more social accounts" — generic language that does not name a UI. The API now genuinely supports this (verified above); the requirement is satisfied at the level it is written.
- `creator-onboarding` spec (spec.md:15-20) explicitly lists social accounts among fields the wizard **"MAY collect"** (optional), alongside `display_name`, `bio`, `sub_niche`, frequencies, and `preferred_formats` — never a MUST. `ProfileForm.tsx` lacking a social-account editing section is consistent with an explicit MAY that was not exercised, not a MUST that was skipped.
- **Conclusion**: no spec requirement is unimplemented. The UI gap is a legitimate separate product decision (already flagged as a follow-up in the apply-progress record: *"Deliberately NOT in scope... Follow-up for a future unit if the wizard needs to let users edit social accounts post-onboarding"*), not a blocker to archive.

---

### Updated Spec Compliance Matrix delta — `creator-profile`

| Requirement | Scenario | Prior result | New result |
|---|---|---|---|
| Social Accounts as Part of Profile | Social accounts submitted with profile update | ❌ CRITICAL | ✅ COMPLIANT — `test_put_profile_with_social_accounts_forwards_them`, `test_update_profile_with_social_accounts_replaces_them` |

All other rows unchanged from the prior report (8 COMPLIANT, 4 PARTIAL, 2 UNTESTED as before, now 9 COMPLIANT / 4 PARTIAL / 2 UNTESTED with the CRITICAL row moved to COMPLIANT). Combined scenario total: **17/23 fully COMPLIANT** (was 16/23), 4 PARTIAL, 2 UNTESTED, **0 CRITICAL** (was 1).

---

### Verdict

**PASS WITH WARNINGS.**

The sole CRITICAL from the prior run — social accounts silently dropped on `PUT /api/profile` — is genuinely closed. The fix is exactly as narrow as diagnosed (one field added to `ProfileUpdate`; `profile_service.py` and `routers/profile.py` confirmed unchanged via diff), the omit-vs-empty-list distinction was traced through `model_dump()` → `fields.pop(..., None)` → `is not None` guard and found to work correctly (no wipe hazard: an update that omits `social_accounts` cannot clear existing accounts), and 11 new tests make real, non-tautological assertions covering both the router and service layers, including negative assertions (`assert_not_awaited()`) for the omitted case. No second defect was introduced by the remediation. The frontend cleanup commit (`36ce44b`) left no dangling references — confirmed via grep and a clean `tsc`/`build`. All 7 requested gates pass at their expected counts (56 backend tests, 65 frontend tests, clean tsc, 5 pre-existing lint warnings / 0 errors, exactly 52 pre-existing ruff findings, clean alembic check, successful build with `ƒ Proxy (Middleware)`).

Five of the six prior WARNINGs remain open — all are pre-existing untested-scenario gaps (cross-user isolation, wrong-typed field rejection, 2-of-4-missing-fields scenario, upsert/dedup unit coverage, GET-populated-profile coverage) that were out of scope for this remediation and do not block archive under this project's own precedent (e.g. `test_chats.py` has the same cross-user gap). The `ProfileForm.tsx` social-account UI gap is confirmed, by direct spec text, to not violate any MUST requirement — the API contract is what the spec mandates, and the wizard-level inclusion is explicitly optional (MAY).

**Recommendation**: eligible for `sdd-archive`. The remaining open items are pre-existing, low-risk, spec-permitted gaps, not blockers.
