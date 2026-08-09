# Archive Report — docker-deploy-setup

**Status**: ARCHIVED
**Date**: 2026-08-08
**Change**: docker-deploy-setup
**Verdict**: CLOSED — Pass with warnings

---

## Executive Summary

The `docker-deploy-setup` change has been successfully archived. All 11 exit criteria were met, all 25 task subtasks completed, and the complete Docker/compose containerization work is verified and ready for deployment. The change moved the frontend base image from `node:20-alpine` to `node:22-alpine` due to Node.js version compatibility with pnpm 11.1.1 (documented deviation, still within `engines.node: ">=20"`), and fixed two minor architectural interactions discovered during verification (dev overlay healthcheck condition and image tag collision). No blocking issues remain.

---

## Artifacts Archived

All change artifacts have been moved from `openspec/changes/docker-deploy-setup/` to `openspec/changes/archive/2026-08-08-docker-deploy-setup/` with complete traceability:

### Files in archive folder

- **proposal.md** — Complete proposal with scope, approach, decisions, exit criteria, and 11 proposal questions (all answered).
- **design.md** — Technical design with 13 detailed sections covering build graph, environment topology, Dockerfile staging, compose configuration, and the one source change (profile-status.ts URL resolution).
- **tasks.md** — 25 subtasks across 6 task groups (Task 0-5), all marked complete [x], with detailed verification evidence for behavioral checks.
- **verification-report.md** — Independent verification report confirming all exit criteria met, no critical issues, one warning (host-dev .env cwd collision), one suggestion (stale Engram mirror).

### No delta specs

Per `sdd-spec` determination (Engram obs #66), zero capabilities are added/modified/removed/renamed by this change. It is pure infrastructure work (Dockerfiles, compose YAML) plus one three-line source change. No specs/ folder exists in this change.

---

## Engram Observation References (Traceability Chain)

**Complete chain of custody for the change:**

| Observation ID | Title | Type | Timestamp | Status |
|---|---|---|---|---|
| #65 | sdd/docker-deploy-setup/proposal | architecture | 2026-08-07 23:38:55 | active |
| #66 | sdd/docker-deploy-setup/spec | architecture | 2026-08-07 23:47:19 | active |
| #67 | sdd/docker-deploy-setup/design | architecture | 2026-08-07 23:51:49 | active |
| #68 | sdd/docker-deploy-setup/tasks | architecture | 2026-08-08 17:23:42 | active |
| #69 | sdd/docker-deploy-setup/apply-progress | architecture | (earlier, stale) | active |
| #72 | sdd/docker-deploy-setup/verify-report | architecture | 2026-08-08 19:42:42 | active |
| (this) | sdd/docker-deploy-setup/archive-report | architecture | 2026-08-08 | active |

---

## Key Findings & Decisions

### Exit Criteria — All Met

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `docker compose build` succeeds from clean clone | PASS | Tasks 5.1, 3.3 |
| 2 | `docker compose up` brings both services healthy | PASS | Task 5.2 |
| 3 | Real Supabase auth round-trip in browser | PASS | Task 5.3 |
| 4 | Server-side onboarding proxy redirects correctly | PASS | Task 5.4 |
| 5 | Dev overlay hot reload for both services | PASS | Tasks 5.5, 5.6 |
| 6 | No `.env`, `.env.local`, node_modules, or `.git` in images | PASS | Tasks 2.3, 3.4 |
| 7 | No postgres or SUPABASE_JWT_SECRET in compose | PASS | Task 4.4 |
| 8 | No `npm run` in compose (pnpm only) | PASS | Task 4.4 |
| 9 | Host-native workflows unregressed | PASS | Task 5.7 |
| 10 | No new Alembic migrations | PASS | Task 5.8 |
| 11 | No GCP/Cloud Run files touched | PASS | Task 5.9 |

### Real-World Deviations (Documented, Not Issues)

1. **Node base image**: `node:22-alpine` instead of `node:20-alpine`
   - Reason: pnpm 11.1.1 requires Node >=22.13; node:20-alpine failed with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`
   - Still within `engines.node: ">=20"`
   - Applied consistently to both frontend/Dockerfile and frontend/Dockerfile.dev
   - Documented in tasks.md 3.3 verification section

2. **Dev overlay architecture fixes** (mid-flight, not scope changes)
   - **D5/D12 interaction**: dev overlay's Dockerfile.dev (no HEALTHCHECK) conflicted with base file's frontend depends_on condition: service_healthy. Fixed with explicit override in docker-compose.dev.yml.
   - **Image tag collision**: Compose's default `<project>-<service>` naming caused dev and prod builds to share tags. Fixed with explicit `image:` directives in dev overlay.
   - Both fixes are documented in verification-report.md and present in the applied files.

### Minor Warnings (Non-Blocking)

1. **Host-native pytest cwd collision**: root `.env` created during Docker verification shadows backend/.env when pytest runs from repo root. Mitigation: run from `backend/` directory or make env_file path absolute. CI unaffected (does not run pytest). Documented for future reference.

2. **Stale Engram apply-progress mirror**: obs #69 records older partial state; tasks.md is the current source of truth. No impact on archive.

---

## Delivered Capabilities

**Infrastructure/build capabilities** (no user-facing capability changes):

- Local containerization via `docker compose up --build` from clean clone
- Multi-stage Dockerfiles with correct secrets exclusion (backend: pip, non-root; frontend: standalone output, build-arg inlining)
- Correct environment variable topology for dual-namespace resolution (browser vs. compose network)
- Dev overlay with hot reload for both services
- `.dockerignore` with secrets/build artifact exclusion
- Compose configuration with Supabase-only (no local Postgres), no deprecated JWT secret

**Application source change**:

- `frontend/shared/lib/profile-status.ts`: `resolveBackendUrl()` function with precedence BACKEND_INTERNAL_URL → NEXT_PUBLIC_API_URL → http://localhost:8000

**Cleanup**:

- Removed dead `supabase_jwt_secret` from backend/app/config.py
- Removed dead postgres service from docker-compose.yml
- Removed dead SUPABASE_JWT_SECRET from docker-compose.yml
- Replaced `npm run dev` with `pnpm dev` (project uses pnpm only)

---

## Test Coverage

**Unit tests** (strict_tdd applies):
- `frontend/shared/lib/profile-status.test.ts`: 3 new tests for resolveBackendUrl() precedence (RED→GREEN TDD), 5 existing fail-open tests stay green untouched

**Behavioral verification** (no unit test surface):
- Docker build (multi-stage, secrets excluded)
- Docker Compose orchestration (health checks, service dependencies, hot reload)
- Browser-based auth and onboarding redirect
- Host-native regression (backend pytest, frontend vitest, pnpm dev)

---

## Known Items for Future Work

These are explicitly NOT blockers for archiving but are documented for reference:

1. **Host-native pytest cwd collision** — may want to make backend/app/config.py's env_file path absolute or establish a convention to run pytest from backend/ directory only
2. **Edge-runtime BACKEND_INTERNAL_URL visibility** — currently supplied through both build ARG and runtime env as a defensive measure; if Next 16 behavior changes, may need to adjust (documented in design §7.3)
3. **GCP deployment** — this change is the prerequisite; Cloud Run constraints (PORT, HOSTNAME, secret mounting) are the next phase, not touched here

---

## Approval & Closure

**Verdict**: PASS WITH WARNINGS
- 0 CRITICAL issues
- 0 BLOCKING issues
- 1 WARNING (benign host-dev collision)
- 1 SUGGESTION (stale metadata, not affecting change)
- All 11/11 exit criteria met
- All 25/25 task subtasks completed

**Change is ready for deployment and requires no further work before the GCP deployment phase begins.**

---

## Archive Metadata

| Field | Value |
|---|---|
| Change ID | docker-deploy-setup |
| Archive date | 2026-08-08 |
| Archive path | openspec/changes/archive/2026-08-08-docker-deploy-setup/ |
| Proposal obs | #65 |
| Spec determination obs | #66 |
| Design obs | #67 |
| Tasks obs | #68 |
| Verify report obs | #72 |
| Archive report obs | (this report, to be saved as topic_key sdd/docker-deploy-setup/archive-report) |
| Changed lines | ~260-270 (within 400-line budget) |
| Delivery shape | Single PR, single slice |
| Delta specs | Zero (no new/modified/removed capabilities) |
| Chained PRs | None |
