```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2e61e1965d54a236bb4103f50f54afa360e2985c
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

## Verification Report (ROUND 3 — independent re-verification after Judgment Day round-one correction)

**Change**: onboarding-profile
**Version**: N/A (delta specs, 2 new capabilities)
**Mode**: Strict TDD
**Round 1 verdict**: FAIL (1 CRITICAL — social accounts dropped on `PUT /api/profile`, 6 WARNING).
**Round 2 verdict**: PASS WITH WARNINGS — later shown to be **wrong**: an independent Judgment Day adversarial review (two blind judges) over the same code found **two CRITICAL data-loss defects (JD-1, JD-2)** that round 2 did not catch. Full round-1/round-2 text preserved below this section, unedited, as the historical record.
**This run**: re-verifies commit `2e61e19` (JD-1/JD-2 fix, tests: 65 backend / 65 frontend) on top of the previously-verified baseline. Every claim below is grounded in a command actually run in this session (see Gates) and a file/line actually read (see diffs quoted).

### Why round 2 missed JD-1 and JD-2 — acknowledged, not glossed over

Round 2 verified that the `social_accounts` CRITICAL fix (`e121b5b`) was narrowly scoped and correctly reasoned that `fields.pop("social_accounts", None)` + `is not None` correctly distinguished omission from `[]` **for that one field**. It did not re-examine the *other* branch of the same `update_profile` loop — `if value is not None and hasattr(profile, key): setattr(profile, key, value)` — which silently discarded every explicit `null` sent for a scalar field (`bio`, `display_name`, etc.), and it did not check `complete_onboarding` at all, which had no such guard and used a bare `model_dump()` that overwrote every omitted optional field with its schema default on every resubmission. Both were pre-existing, not introduced by `e121b5b`. This round traces both fixes end to end rather than trusting the commit message or the prior report's framing.

### JD-1 — clearing a profile field never persisted — CLOSED, verified

**Defect** (pre-fix): `ProfileService.update_profile` guarded every field with `if value is not None`, so an explicit `null` sent by the client (e.g. `ProfileForm.tsx:80` — `value.trim() === "" ? null : value`, confirmed present at that exact line in the current tree) was silently discarded — the router (`profile.py`) called `payload.model_dump()` with no unset-filtering, so an omitted field and an explicit null were both `None` by the time they reached the service, and the service's guard treated both as "leave alone."

**Fix, read directly** (`git show 2e61e19`):
- `backend/app/routers/profile.py:46-48` — `profile_service.update_profile(db, user_id, **payload.model_dump(include=payload.model_fields_set))`. `model_fields_set` is Pydantic's bookkeeping of which top-level keys were actually present in the request body, independent of their value — confirmed interactively in this session:
  ```
  >>> ProfileUpdate(bio=None).model_fields_set   -> {'bio'}
  >>> ProfileUpdate().model_fields_set           -> set()
  >>> ProfileUpdate(bio=None).model_dump(include={'bio'})  -> {'bio': None}
  >>> ProfileUpdate().model_dump(include=set())            -> {}
  ```
  So an omitted `bio` never appears as a kwarg at all; an explicit `bio: null` appears as `bio=None`.
- `backend/app/services/profile_service.py:75-77` — the guard changed from `if value is not None and hasattr(profile, key)` to `if hasattr(profile, key)` (the `is not None` check was dropped). Since `fields` now only contains keys the client actually set, dict membership alone is sufficient and correct: a present key (any value, including `None`) is assigned; an absent key never reaches the loop.
- **Result**: an explicit `null` now clears the field (`setattr(profile, key, None)` runs); an omitted field is never in the `fields` dict, so it is never touched. The two cases that were previously indistinguishable are now distinguished at the router boundary (`model_fields_set`), not re-derived downstream from the value.

**Tests, read directly** (`git show 2e61e19 -- backend/tests/test_profile.py backend/tests/test_profile_service.py`):
- `test_put_profile_explicit_null_clears_field` — sends `{"bio": None}`, asserts `"bio" in kwargs and kwargs["bio"] is None` reaches `update_profile`.
- `test_put_profile_omitted_field_excluded_from_kwargs` — sends `{"niche": "marketing"}` only, asserts `"bio" not in kwargs`.
- `test_put_profile_omitting_social_accounts_leaves_them_untouched` was **rewritten** from asserting `kwargs["social_accounts"] is None` to asserting `"social_accounts" not in kwargs` — the assertion itself changed to match the new (correct) key-presence semantics, not just added alongside the old one. This is real evidence the fix wasn't bolted on without updating what "correct" means for the pre-existing test.
- Service level: `test_update_profile_clears_field_with_explicit_null` (`update_profile(db, "user-1", bio=None)` → `fake_profile.bio is None` after) and `test_update_profile_leaves_omitted_field_untouched` (`update_profile(db, "user-1", niche="tech")` → `fake_profile.bio` unchanged, `fake_profile.niche == "tech"`) both directly assert on object state, not mock call args — a stronger assertion class than round 2's router-level mock-kwargs checks.

**JD-1 status: CLOSED.** Verified by reading the diff, running the interactive Pydantic check above in this session, and reading the four tests that exercise both directions.

### JD-2 — resubmitting onboarding destroyed data — CLOSED, verified

**Defect** (pre-fix): `complete_onboarding` did `data = payload.model_dump() if hasattr(payload, "model_dump") else dict(payload)` — no guard at all, no unset-filtering — so every optional field omitted on a resubmission was overwritten with `ProfileCreate`'s schema default (`None` for scalars). Worse, `ProfileCreate.social_accounts` defaults to `[]` (not `None`, confirmed at `backend/app/schemas/profile.py:24`), so `data.pop("social_accounts", None)` always yielded a real list (`[]` when omitted), the `is not None` guard downstream always fired, and `_replace_social_accounts` ran on every resubmission — deleting every existing `SocialAccount` row even when the client's request never mentioned social accounts.

**Fix, read directly** (`backend/app/services/profile_service.py:84-109`):
- Same `model_fields_set`-based filtering as `update_profile`, applied inside the service this time (not the router, since `complete_onboarding` is called directly with the `ProfileCreate` payload object): `data = payload.model_dump(include=payload.model_fields_set) if hasattr(payload, "model_dump") else dict(payload)`.
- The `dict(payload)` fallback branch is preserved for raw-dict test callers — in that branch, dict-key presence already means "explicitly sent," so it needs no further filtering; this is a deliberate, documented (comment at line 92-94) choice, not an oversight.
- Same `for key, value in data.items(): if hasattr(profile, key): setattr(profile, key, value)` loop as `update_profile`, and same `if social_accounts is not None:` gate feeding the same `_replace_social_accounts` helper both methods share.

**Tests, read directly**:
- `test_post_onboarding_resubmission_preserves_omitted_optional_field` — submits only the 4 required fields, asserts `"bio" not in payload.model_fields_set` on the `ProfileCreate` object the router actually constructs from the request body (not a hand-built payload) — proves the *router's own Pydantic parsing* correctly excludes `bio` from `model_fields_set` when omitted from JSON, which is the load-bearing assumption the whole fix depends on.
- `test_post_onboarding_resubmission_without_social_accounts_key` — same pattern for `social_accounts`, the field whose wrong default (`[]`) caused JD-2.
- Service level: `test_complete_onboarding_preserves_omitted_optional_fields` — omits `bio` from a real `ProfileCreate(...)` construction, asserts `fake_profile.bio == "bio existente"` (unchanged) after `complete_onboarding` runs.
- `test_complete_onboarding_without_social_accounts_preserves_existing` — omits `social_accounts` from `ProfileCreate(...)`, asserts `replace_mock.assert_not_awaited()` — the delete-then-recreate path never runs.
- `test_complete_onboarding_explicit_empty_social_accounts_clears` — passes `social_accounts=[]` **explicitly** to `ProfileCreate(...)`, asserts `replace_mock.assert_awaited_once_with(db, fake_profile, [])` — confirms an intentional empty list still clears, so the fix didn't overcorrect into "social_accounts can never be cleared via onboarding resubmission."

**Confirmed the frontend always sends `social_accounts` explicitly on wizard submit**, closing the loop from schema to real caller: `frontend/features/onboarding/hooks/useOnboardingWizard.ts:109` — `social_accounts: draft.social_accounts` is present in every submitted payload object (unconditionally, even when the array is empty), so `model_fields_set` will always include `"social_accounts"` for a real wizard submission — meaning a real resubmission always hits the "explicit, possibly-empty list" branch, never the "omitted" branch that would leave stale accounts. Read directly, not assumed.

**JD-2 status: CLOSED.** Verified via the diff, the schema default that caused it (`ProfileCreate.social_accounts: list[SocialAccountCreate] = []` at `profile.py:24`, still present but now inert because `model_fields_set` gates its use), the five tests covering omit/explicit-empty/explicit-null-adjacent cases, and by tracing the one real caller (`useOnboardingWizard.ts:109`) to confirm the always-sends-the-key behavior the fix relies on.

### Residual asymmetry found — NEW, not data-loss, recorded as a WARNING (not CRITICAL)

While tracing JD-1/JD-2 end to end, this round found that the fix is **not fully symmetric for `social_accounts` specifically**, unlike every scalar field:

- For scalar fields (`bio`, `niche`, ...), the per-field loop operates on **dict-key membership** (`for key, value in fields.items()`), so "omitted" (key absent) and "explicit null" (key present, value `None`) are genuinely distinguished after the `model_fields_set` filtering.
- For `social_accounts`, both `update_profile` (`profile_service.py:73`) and `complete_onboarding` (`profile_service.py:100`) extract it with `fields.pop("social_accounts", None)` / `data.pop("social_accounts", None)` — a `dict.pop` with a **default of `None`**. This collapses two distinct states back into one: "key absent" (omitted) returns the default `None`, and "key present with value `None`" (an explicit `social_accounts: null` in the request body) *also* evaluates to `None`, because the actual stored value in that case is `None`. Verified interactively in this session:
  ```
  >>> ProfileUpdate(social_accounts=None).model_fields_set                 -> {'social_accounts'}
  >>> ProfileUpdate(social_accounts=None).model_dump(include={'social_accounts'})  -> {'social_accounts': None}
  ```
  i.e. the *schema* correctly reports the field as explicitly set, and `model_dump` correctly reflects the `None` value — but `fields.pop("social_accounts", None)` at the service layer cannot tell "the key wasn't in the dict" apart from "the key was in the dict, mapped to `None`," because both paths produce the local variable `social_accounts = None`, and the code then does `if social_accounts is not None: ...`, which is `False` in both cases.
- **Practical impact**: sending `social_accounts: null` explicitly on `PUT /api/profile` or `POST /api/profile/onboarding` silently no-ops (existing accounts untouched) instead of either clearing them or being rejected. This is **not a data-loss bug** — it is the opposite, an overly conservative no-op — and it is currently **unreachable from any client in this codebase**: `rg -n "social_accounts" frontend/` shows the only two writers are `useOnboardingWizard.ts:109` (always sends a list, `draft.social_accounts`, never `null` — the local state is typed `SocialAccount[]`, never nullable) and the profile services' TypeScript types (`profile-api.ts:42` — `social_accounts?: SocialAccount[]`, optional-when-absent but never typed to allow `null`). `ProfileForm.tsx` has no social-account editing UI at all (confirmed again this round, unchanged from round 2), so it never emits the key in either form.
- **Disposition**: recorded as a new WARNING (not a CRITICAL, not a regression — the underlying inconsistency predates this remediation and predates round 1; it was simply never exercised or examined until this round traced `social_accounts` symmetrically against the scalar-field fix). Follow-up: either extend `_replace_social_accounts`'s trigger to use the same key-presence check as scalar fields (distinguish via a sentinel rather than `pop(..., None)`), or explicitly reject `social_accounts: null` at the schema level if the intent is that only `[]` may clear it. Not a blocker — no reachable path exercises it today, and no spec scenario requires null-clearing semantics for social accounts (spec.md only requires `[]` to be permitted, which is separately tested and unaffected).

### Spec traceability re-mapped for the changed semantics

Re-read `creator-profile` spec (Engram obs #9) against the new implementation, specifically the requirements whose text touches update/omission semantics:

- **"Profile Creation and Update"**: *"Partial update MUST only change supplied fields, leaving omitted fields unchanged."* — Previously this was true only in the degenerate sense that *no* client-null could ever change anything (over-conservative, not "supplied fields change" but "no field can ever be cleared"). Now it is true in the letter and spirit of the requirement: a supplied field (including an explicit `null`) changes; an omitted field does not. **No contradiction — the new behavior is a strictly closer match to this requirement's text than the old one was**, since the old behavior couldn't apply a supplied `null` at all.
- **"Partial update preserves other fields"** scenario (*"GIVEN existing profile with tone set, WHEN update submits only bio, THEN bio updates, tone unchanged"*): still holds — `tone` is absent from `model_fields_set` when not submitted, never enters the `fields` dict, never touched. Re-confirmed via `test_update_profile_leaves_omitted_field_untouched`.
- **"Re-submitting onboarding updates not duplicates"** scenario (*"GIVEN already onboarded user, WHEN onboarding input resubmitted, THEN existing row updated, no second row"*): this scenario's text is about row identity (no duplicate), not field-level semantics, and remains satisfied (`get_or_create_profile` unchanged, still upserts by `user_id`). The field-preservation behavior JD-2 fixed is a stricter, implied reading consistent with "Partial update MUST only change supplied fields" applying equally to the onboarding endpoint — no scenario text explicitly required this before, but nothing in the spec text is now contradicted by fixing it; if anything the fix makes `complete_onboarding` consistent with the same requirement `update_profile` was already held to.
- **No scenario found that requires or forbids null-clearing semantics for `social_accounts` specifically** — the residual asymmetry above does not contradict any written scenario, since spec.md's "Social Accounts as Part of Profile" requirement only discusses "submitting with create/update" and "zero accounts" (i.e. `[]`), never `null`.

**Conclusion: no spec scenario contradicts the new implementation.** The fix moves the implementation closer to the spec's stated partial-update contract, not further from it.

### Previously-open WARNINGs — re-dispositioned this round

1. **Task/apply-progress drift on "Optional cleanup"** — unchanged from round 2, **RESOLVED** (this was about a record-keeping correction unrelated to JD; no new information this round).
2. **Cross-user profile isolation has no dedicated end-to-end test** — **STILL OPEN, unchanged.** JD-1/JD-2's fix commit added no cross-user test; `rg -n "user-2|other_user|user_b" backend/tests/test_profile*.py` in this session returns nothing beyond the existing single-user-scoping assertions already credited in round 2. Not worsened, not resolved.
3. **"Wrong-typed field rejected" scenario is untested** — **STILL OPEN, unchanged.** No test touching this was added in `2e61e19`; confirmed via the diff (`git show 2e61e19 --stat`), which touches only `routers/profile.py`, `services/profile_service.py`, and the two `test_profile*.py` files, none of which add a type-validation test.
4. **"Profile with only some required fields" (2-of-4 missing) scenario not reproduced exactly** — **STILL OPEN, unchanged.** `_missing_fields()` untouched by this commit; no new test targets it.
5. **`get_or_create_profile`'s select-then-insert race has no IntegrityError handling** — **STILL OPEN, unchanged, and independently corroborated.** Read `backend/app/services/profile_service.py:43-55` again this round: `select` → `scalar_one_or_none()` → conditional `db.add()` + `flush()` is still a plain select-then-insert with no `try/except IntegrityError` around the insert path, and no new test in `2e61e19`'s diff touches this method. This is the same gap a Judgment Day judge flagged independently (per the task brief). Disposition: **genuinely still open, not superseded by JD-1/JD-2's fix (different code path entirely — this is a concurrency/uniqueness gap, JD-1/JD-2 were a value-semantics gap)**. `unique=True` on `CreatorProfile.user_id` (`backend/app/models/profile.py:20`, confirmed present) remains the hard DB-level backstop that prevents actual duplicate rows even if two concurrent requests both pass the `scalar_one_or_none() is None` check — the failure mode is an unhandled `IntegrityError` surfacing as a 500 to one of the two concurrent requests, not silent data corruption. Recommended as a follow-up, not a blocker, consistent with round 2's framing, now with an explicit concurrency-vs-value-semantics distinction drawn against the two closed JD findings.
6. **GET `/api/profile`'s "existing profile is returned" scenario has no dedicated test** — **STILL OPEN, unchanged.** No GET-path test added in `2e61e19`'s diff.

**Summary**: 1/6 resolved (unchanged from round 2), 5/6 remain open exactly as before, with warning 5 now explicitly cross-checked against and distinguished from the two closed JD CRITICALs, and one **new** WARNING recorded above (the `social_accounts` explicit-null asymmetry) discovered by this round's symmetric tracing of the JD fix — not present in round 2's list because round 2 never traced that code path.

### Constraints re-confirmed this round

| Constraint | Status | Evidence (read/run this session) |
|---|---|---|
| Completion rule lives in exactly one place, server-side | ✅ Unchanged | `profile_service.py:13-39` (`REQUIRED_PROFILE_FIELDS`/`_missing_fields`) absent from `2e61e19`'s diff (confirmed via `git show 2e61e19 --stat`, which lists only `routers/profile.py`, `services/profile_service.py` [the `update_profile`/`complete_onboarding` methods only, not `_missing_fields`], and the two test files). |
| `user_id` scoping on every query | ✅ Unchanged | `get_or_create_profile` (the only DB-query entry point both fixed methods route through) untouched by this commit; both `update_profile` and `complete_onboarding` still call `self.get_or_create_profile(db, user_id)` before any field mutation. |
| No path/query user identifier anywhere | ✅ Unchanged | `routers/profile.py:33-59` (full file re-read this round) — every endpoint still derives `user_id` exclusively from `Depends(get_current_user)`; zero path/query parameters carry an identifier. |
| No redirect loop in `proxy.ts` | ✅ Unchanged, re-read in full this round | `frontend/proxy.ts:72-77` — `isOnboardingRoute` still excludes the `/onboarding`-bound redirect while already on `/onboarding`; file untouched by `2e61e19` (backend-only commit, confirmed via diff stat). |
| Fail-open on a failing status call | ✅ Unchanged | `frontend/shared/lib/profile-status.ts` untouched by `2e61e19`; `proxy.ts:55-61` still treats a `null` result from `fetchProfileStatus` as "no signal," and neither branch that redirects (`onboardingCompleted === false` / `=== true`) fires on `null`. |

### Two Judgment Day WARNINGs — confirmed present, deliberately unfixed, recorded as follow-ups (not blockers)

1. **`frontend/proxy.ts:90-93`** — the landing/auth/callback redirect branch reads `onboardingCompleted`, but that variable is only assigned a non-`null` value inside `if (user && isProtectedRoute)` (`proxy.ts:56-62`); `/login`, `/signup`, `/`, and `/callback` are never in `protectedPrefixes` (`proxy.ts:39`), so `onboardingCompleted` is always `null` when the branch at line 90 runs. `onboardingCompleted === false` at line 92 is therefore always `false`, and the ternary always resolves to `/chat` — the `/onboarding` arm of that specific ternary is dead code. Confirmed by re-reading the file this round (quoted above in the constraints table). **Effect**: an incomplete-profile user who lands on `/login`/`/`/`/callback` while already authenticated is routed to `/chat` first, which (being a protected route) then correctly re-evaluates and redirects to `/onboarding` on the next request — one extra hop, no loop, no lockout. Recorded as a follow-up per the task brief, not a defect.
2. **`get_or_create_profile` select-then-insert has no `IntegrityError` handling** — see disposition under prior WARNING 5 above. Recorded as a follow-up, not a defect, with the `unique=True` DB constraint as the backstop against actual corruption.

### Gates — run independently in this session, verbatim

**Backend tests** (`mamba run -n contentspark pytest backend/tests`):
```
collected 65 items

backend/tests/test_auth.py ....                                          [  6%]
backend/tests/test_chat.py .....                                         [ 13%]
backend/tests/test_chat_service.py ....                                  [ 20%]
backend/tests/test_chats.py ...........                                  [ 36%]
backend/tests/test_models_indexes.py ....                                [ 43%]
backend/tests/test_profile.py .................                          [ 69%]
backend/tests/test_profile_service.py ....................               [100%]

======================== 65 passed, 1 warning in 0.18s =========================
```
Matches expected count (65 = 56 prior + 9 new).

**Frontend tests** (`pnpm --dir frontend test`):
```
 Test Files  9 passed (9)
      Tests  65 passed (65)
```
Matches expected count (unchanged — remediation was backend-only).

**TypeScript** (`pnpm --dir frontend exec tsc --noEmit`): exit code 0, no output — clean.

**Lint** (`pnpm --dir frontend lint`): `✖ 5 problems (0 errors, 5 warnings)` — exact expected baseline, all in files untouched by this change (`coverage/block-navigation.js` generated; `CalendarGrid.tsx`, `MobileNav.tsx`, `Footer.tsx`, `Navbar.tsx` pre-existing).

**Ruff** (`mamba run -n contentspark ruff check backend/`): `Found 52 errors.` — exact expected count, unchanged.

**Alembic** (`cd backend && mamba run -n contentspark alembic check`): `No new upgrade operations detected.` exit 0 — `2e61e19` changes only Python control flow (guard removal, `model_fields_set` filtering), no model/column changes; correctly requires no migration.

**Build** (`pnpm --dir frontend build`):
```
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 1748ms
  Running TypeScript ...
  Finished TypeScript in 1576ms ...
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
Matches expected — `ƒ Proxy (Middleware)` present, build succeeds.

All 7 requested gates pass at their expected counts, run fresh in this session (not copied from round 2's output — commands re-executed, outputs re-captured above).

### Updated Spec Compliance Matrix — this round

No scenario changed COMPLIANT/PARTIAL/UNTESTED status this round: JD-1/JD-2 were value-semantics defects in code paths that round 2 had already marked COMPLIANT for the *scenarios that exist in the spec text* (the spec has no explicit "clear a field with null" scenario — see traceability section above), so there is no matrix cell that was previously wrongly marked compliant. The matrix total remains **17/23 fully COMPLIANT, 4 PARTIAL, 2 UNTESTED, 0 CRITICAL**, now with the underlying implementation of the "Partial update preserves other fields" and "Re-submitting onboarding updates not duplicates" rows materially hardened by JD-1/JD-2's fix (same COMPLIANT status, stronger evidence underneath it — reflected in the WARNING-level residual asymmetry noted above rather than a matrix downgrade, since no scenario is violated).

### Verdict

**PASS WITH WARNINGS.**

Both Judgment Day CRITICALs are genuinely closed, verified independently in this session (not by trusting the commit message or the JD report): JD-1 (field-clearing) via a diff read, an interactive Pydantic `model_fields_set` check run in this session, and four tests exercising both the router and service layers; JD-2 (onboarding resubmission data loss) via the same pattern applied to `complete_onboarding`, plus tracing the one real frontend caller (`useOnboardingWizard.ts:109`) to confirm it always sends `social_accounts` explicitly, closing the loop between the schema-level fix and actual client behavior. All 7 requested gates were re-run fresh in this session and match their expected counts exactly (65 backend tests, 65 frontend tests, clean tsc, 5 pre-existing lint warnings, exactly 52 pre-existing ruff findings, clean alembic check, successful build with `ƒ Proxy (Middleware)`).

This round found **one new WARNING** the previous two rounds missed: `social_accounts` uses a `dict.pop(key, None)` extraction pattern that cannot distinguish "omitted" from "explicit null" the way the fixed scalar-field path now can, because both cases evaluate to the same local `None`. This is not data loss (it is an over-conservative no-op) and is currently unreachable by any client in the codebase (verified via `rg` over `frontend/` — no writer ever sends `social_accounts: null`), so it does not block archive, but it is recorded here rather than silently accepted, per this round's explicit mandate not to soften findings after a remediation.

Five of six prior WARNINGs remain open exactly as before (cross-user isolation test, wrong-typed-field test, 2-of-4-missing-fields test, GET-populated-profile test, and `get_or_create_profile`'s select-then-insert race — the last now explicitly distinguished from JD-1/JD-2 as a different, concurrency-class gap, independently corroborated by a Judgment Day judge, backstopped by the `unique=True` DB constraint). The two Judgment Day WARNINGs the task brief flagged as deliberately unfixed (`proxy.ts`'s dead `/onboarding` ternary arm on the landing/auth branch, and the same `get_or_create_profile` race) are confirmed present exactly as described and are recorded as follow-ups, not defects, per their disposition in the task brief.

**Recommendation**: eligible for `sdd-archive`. No CRITICAL remains open. The one new WARNING found this round is a genuine, non-blocking, currently-unreachable inconsistency worth a follow-up ticket, not a reason to withhold archive — it does not regress any spec scenario and does not lose data.

---

## Historical record — Round 2 report (superseded by Round 3 above; preserved verbatim, not edited)

**Round 2's verdict was PASS WITH WARNINGS and stated the sole prior CRITICAL was closed. That was correct as far as it went (the `social_accounts` fix was, and remains, correctly scoped), but Judgment Day's adversarial review subsequently found two CRITICAL defects in adjacent code that round 2 did not examine (see "Why round 2 missed JD-1 and JD-2" above). The text below is preserved unedited for audit history.**

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
