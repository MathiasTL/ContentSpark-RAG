# Tasks: Containerize ContentSpark for Local Compose

**No delta specs** — confirmed by `sdd-spec` (Engram `sdd/docker-deploy-setup/spec`):
zero capabilities are added/modified/removed/renamed. This is infrastructure work
(Dockerfiles, compose YAML, env wiring) plus one three-line application source
change. Task-to-requirement traceability below points at the proposal's **exit
criteria** (`proposal.md` "Exit criteria" section) instead of a spec capability,
since none exists for this change.

STRICT TDD is active project-wide (`openspec/config.yaml`), but almost none of
this change is unit-testable — Dockerfiles and compose YAML have no test
surface. The **one** exception is `resolveBackendUrl()` in
`frontend/shared/lib/profile-status.ts` (design §7, §10.1), which gets real
RED→GREEN TDD. Everything else is verified **behaviourally**: actual
`docker compose build`/`up` runs and a real browser check, encoded as explicit
`[VERIFY]` tasks, never as pytest/vitest substitutes.

**Delivery shape**: single PR, single slice (design §12) — the proposal
estimates ~270 changed lines against a 400-line budget with headroom for the
alpine→slim fallback. There is no useful intermediate state to split at: a PR
with Dockerfiles but the old compose file does not come up, and a PR with the
new compose file but no Dockerfiles is the exact broken state this change
repairs.

Verified before writing this list (do not re-derive; see design §0-§13 and
proposal.md's Decisions/Risks):
- Zero Dockerfiles exist anywhere in the repo today; both compose files
  reference targets that do not exist.
- `SUPABASE_JWT_SECRET` has zero live readers anywhere in the repo (design §9
  grep table) — safe to remove from both `Settings` and compose.
- `frontend/shared/lib/profile-status.test.ts` already exists with 5 passing
  `fetchProfileStatus` tests (fail-open, stub `fetch`, never assert on URL) —
  these must stay green untouched through the refactor.
- `node:20-alpine` is the primary frontend base; `node:20-slim` is the
  documented mechanical 4-line fallback (design §3.3) if `sharp`/
  `unrs-resolver` hit musl issues — this must be **tried for real** during
  Task 3, not assumed either way.
- `BACKEND_INTERNAL_URL` must be supplied through **both** a build `ARG` and a
  runtime `environment:` entry (design §7.3/§10) — `proxy.ts` runs on Next's
  Edge runtime, where `process.env` access may be statically inlined at build
  time rather than read at request time. Whichever channel Next 16 actually
  consults, the value must be correct.
- Root `.gitignore`'s existing `.env.*` pattern will swallow a committed
  `.env.example` unless a `!.env.example` negation is added (design §8).
- No Alembic migration runs from any container, in this change or as a
  follow-up — host-only stays host-only (proposal Decision 4).
- Dev images (`Dockerfile.dev` for both services) are deliberately
  single-stage, root user, no healthcheck (design D5) — do not "improve" them
  toward production parity.

---

## Task 0 — `resolveBackendUrl()` in `profile-status.ts` (RED → GREEN)

Independently correct and independently revertible; nothing else in this
change depends on Docker existing yet (design §12, step 1).

### 0.1 — RED
- [x] **0.1.1** [RED] In `frontend/shared/lib/profile-status.test.ts`, add
  `vi.unstubAllEnvs()` to the existing `afterEach` (alongside
  `restoreAllMocks`/`unstubAllGlobals`) so env stubs from the new tests cannot
  leak into the five existing fail-open tests. Add three new tests for a
  not-yet-exported `resolveBackendUrl`: (a) prefers `BACKEND_INTERNAL_URL`
  when both it and `NEXT_PUBLIC_API_URL` are stubbed to different values, (b)
  falls back to `NEXT_PUBLIC_API_URL` when only that is stubbed (use a
  distinguishable third value like `http://api.test:9000`, not the hardcoded
  default, so this branch cannot pass by accident), (c) falls back to the
  literal `"http://localhost:8000"` when both are unset
  (`vi.stubEnv(..., undefined)`). Expect the file to fail to **compile/run**
  (`resolveBackendUrl` is not exported yet) — this is the legitimate RED
  state.
  Exit criterion: 4 (onboarding proxy resolves the correct namespace), 9
  (host-native dev unregressed).

### 0.2 — GREEN
- [x] **0.2.1** [GREEN] In `frontend/shared/lib/profile-status.ts`, replace
  the module-level `const` backend-URL value with an exported function
  `resolveBackendUrl(): string` returning `process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"` — written as
  full member expressions (`process.env.X`), never destructured, so bundler
  static replacement still applies (design §7.2). Call it inside
  `fetchProfileStatus` as `` `${resolveBackendUrl()}/api/profile/status` ``.
  Do not touch `frontend/shared/lib/api-fetch.ts` — it is browser-only and
  already correct. Run 0.1.1 to green. Run `pnpm --dir frontend test` — all 8
  tests in this file (5 existing + 3 new) and the full suite must stay green.
  Exit criterion: 4, 9.

---

## Task 1 — Inert scaffolding: `next.config.ts`, `.dockerignore` × 2, root `.env.example`, `.gitignore`

Nothing here has an effect until a build runs (design §12, step 2). No TDD
applies — none of these files has a test surface.

- [x] **1.1** [IMPL] In `frontend/next.config.ts`, add `output: "standalone"`
  to the exported `NextConfig`. Confirm `pnpm --dir frontend build` still
  succeeds host-native and additionally emits `.next/standalone` (host `pnpm
  dev`/`pnpm start` behaviour is unaffected — verify by spot-check, not by a
  new test).
  Exit criterion: 1, 3 (standalone output is what the frontend runner stage
  copies).
- [x] **1.2** [IMPL] Create `backend/.dockerignore` per design §4: `.env`,
  `.env.*`, `__pycache__/`, `*.py[cod]`, `*.pyo`, `.venv/`, `venv/`,
  `.pytest_cache/`, `.ruff_cache/`, `.coverage`, `htmlcov/`, `*.egg-info/`,
  `data/`, `tests/`, `Dockerfile*`, `.dockerignore`.
  Exit criterion: 6.
- [x] **1.3** [IMPL] Create `frontend/.dockerignore` per design §4: `.env`,
  `.env.*`, `node_modules/`, `.next/`, `out/`, `build/`, `coverage/`,
  `.pnpm-store/`, `*.tsbuildinfo`, `.vercel/`, `Dockerfile*`, `.dockerignore`,
  `README.md`.
  Exit criterion: 6.
- [x] **1.4** [IMPL] Create root `.env.example` documenting only the three
  build-time `NEXT_PUBLIC_*` values Compose must interpolate into
  `build.args`, plus the optional `BACKEND_INTERNAL_URL` override, with the
  design §8 comment block explaining the build-arg/env_file duplication and
  why an empty value here builds green but ships a broken bundle. In root
  `.gitignore`, add `!.env.example` immediately after the existing `.env.*`
  block (design §8's trap) — without this the file is written but never
  staged. Confirm `git status` shows `.env.example` as trackable, not
  ignored.
  Exit criterion: 1, 3.

---

## Task 2 — `backend/Dockerfile` + `backend/Dockerfile.dev` (build verify: backend)

Design §12, step 3 — this is the first real build gate.

- [x] **2.1** [IMPL] Create `backend/Dockerfile`: two-stage
  (`builder`/`runtime`) on `python:3.11-slim`, `/opt/venv` as the transfer
  unit, non-root `appuser` (uid/gid 1001), `WORKDIR /app`, `COPY . .` after
  `COPY --from=builder`, `EXPOSE 8000`, `HEALTHCHECK` via
  `python -c "import urllib.request..."` against `GET http://127.0.0.1:8000/`
  (`--start-period=20s` — cold LangChain/LangGraph/Qdrant/Supabase imports are
  seconds, not milliseconds), `CMD ["uvicorn", "main:app", "--host",
  "0.0.0.0", "--port", "8000"]` — **not** `app.main:app` (entrypoint is
  `backend/main.py`, `backend/app/` is the package). No `curl`/`wget`
  install. `PYTHONUNBUFFERED=1` set (the project's "logging con prints
  descriptivos" convention needs unbuffered stdout inside a container). Verbatim
  per design §1.
  Exit criterion: 1, 2.
- [x] **2.2** [IMPL] Create `backend/Dockerfile.dev`: single stage,
  `python:3.11-slim`, root user, no `COPY` of source (bind mount will shadow
  it), `pip install -r requirements.txt` in its own layer, `EXPOSE 8000`,
  `CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port",
  "8000"]`. Root user here is deliberate (design D5) — do not add a non-root
  user or a healthcheck.
  Exit criterion: 5.
- [x] **2.3** [VERIFY] Run `docker build -f backend/Dockerfile -t
  contentspark-backend:test ./backend` — must succeed. Run `docker build -f
  backend/Dockerfile.dev -t contentspark-backend-dev:test ./backend` — must
  succeed. Run `docker run --rm contentspark-backend:test ls -a /app` and
  confirm no `.env`, `.venv`, `.git`, `data/`, or `tests/` present in the
  image.
  Exit criterion: 1, 6.
  **VERIFIED**: both builds succeeded. `ls -a /app` in the runtime image
  shows only `.claude .gitignore alembic alembic.ini app ingest_data.py
  ingest_tracking.json main.py requirements.txt ruff.toml urls_to_ingest.json`
  — no `.env`, `.venv`, `.git`, `data/`, `tests/`.

---

## Task 3 — `frontend/Dockerfile` + `frontend/Dockerfile.dev` (build verify: frontend)

Design §12, step 4 — **the risky step, deliberately last** so a base-image
fallback does not invalidate already-verified backend work. The alpine→slim
decision (§3.3) is made here, for real, not assumed.

- [x] **3.1** [IMPL] Create `frontend/Dockerfile`: three-stage
  (`deps`/`builder`/`runner`) on `node:20-alpine`, `apk add --no-cache
  libc6-compat` in `deps` and `builder`, corepack pinning `pnpm@11.1.1`, `deps`
  copies `package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml` (not just
  the first two — `.npmrc`'s `minimum-release-age`/`auto-install-peers` and
  `pnpm-workspace.yaml`'s `allowBuilds` for `sharp`/`unrs-resolver` are part
  of the install contract), `pnpm install --frozen-lockfile`. `builder` copies
  `deps`' `node_modules` + full source, declares `ARG`
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/
  `NEXT_PUBLIC_API_URL`/`BACKEND_INTERNAL_URL` and promotes all four to `ENV`
  **before** `pnpm build` (build-time inlining — see design §3). `runner`:
  non-root `nextjs` user (uid/gid 1001), `ENV HOSTNAME=0.0.0.0` (standalone
  `server.js` defaults to `localhost`, unreachable from the compose network
  otherwise), copies `public/`, `.next/standalone`, **and** `.next/static`
  separately (standalone excludes it by design — omitting the copy serves
  unstyled HTML with no error), `RUN mkdir -p .next/cache && chown` for
  writable cache under the non-root user, `EXPOSE 3000`, `CMD ["node",
  "server.js"]`. Verbatim per design §3.
  Exit criterion: 1, 3, 6.
- [x] **3.2** [IMPL] Create `frontend/Dockerfile.dev`: single stage,
  `node:20-alpine` + `libc6-compat`, corepack `pnpm@11.1.1`, copies the same
  four files as `deps` above, `pnpm install --frozen-lockfile` **at image
  build** (not container start — the anonymous `node_modules` volume in
  `docker-compose.dev.yml` seeds from this layer), `EXPOSE 3000`, `CMD
  ["pnpm", "dev"]`.
  Exit criterion: 5.
- [x] **3.3** [VERIFY] Run `docker build -f frontend/Dockerfile -t
  contentspark-frontend:test --build-arg NEXT_PUBLIC_SUPABASE_URL=<placeholder>
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<placeholder> --build-arg
  NEXT_PUBLIC_API_URL=http://localhost:8000 --build-arg
  BACKEND_INTERNAL_URL=http://backend:8000 ./frontend`. **If it fails with a
  native/musl error** (`Error relocating`, a `sharp` prebuild not found, an
  `unrs-resolver` binding load failure): do not patch with per-package
  workarounds — swap all three `FROM node:20-alpine` to `FROM node:20-slim`
  in both `frontend/Dockerfile` and `frontend/Dockerfile.dev` and delete the
  two `apk add --no-cache libc6-compat` lines (design §3.3's documented
  4-line mechanical swap), then retry the build. Record which base image
  actually shipped and, if the swap happened, the original error text — this
  belongs in the change record because it will recur on the future GCP image
  (design §13). If the failure signature is instead a Node-version
  incompatibility (not musl-shaped), the correct move is `node:22-alpine`,
  still within `engines.node: ">=20"` — diagnose which of the two before
  swapping.
  Exit criterion: 1.
  **VERIFIED**: first attempt on `node:20-alpine` failed at
  `pnpm install --frozen-lockfile` with
  `Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite`
  (pnpm logged `warn: This version of pnpm requires at least Node.js
  v22.13`). This is a **Node-version incompatibility, not a musl/native-build
  error** (no `sharp`/`unrs-resolver` signature) — per the task's own
  diagnostic branch, the correct fix is `node:22-alpine`, not the
  `node:20-slim` fallback. Swapped all `FROM node:20-alpine` →
  `FROM node:22-alpine` in `frontend/Dockerfile` (3 stages) and
  `frontend/Dockerfile.dev` (still within `package.json`'s
  `engines.node: ">=20"`). Retried the build — succeeded end to end
  (`pnpm install`, `next build` with Turbopack, standalone output, runner
  stage). **Shipped base image: `node:22-alpine`.**
- [x] **3.4** [VERIFY] Run `docker build -f frontend/Dockerfile.dev -t
  contentspark-frontend-dev:test ./frontend` (same base image decision as
  3.3, applied consistently — the two files must not diverge on base image).
  Run `docker run --rm contentspark-frontend:test ls -a` and confirm no
  `.env`, `.env.local`, host `node_modules`, or `.git` present.
  Exit criterion: 5, 6.
  **VERIFIED**: `Dockerfile.dev` build succeeded on `node:22-alpine`
  (consistent with 3.3). `docker run --rm contentspark-frontend:test ls -a`
  shows only `. .. .next node_modules package.json public server.js` — the
  `node_modules` present is the one baked into the standalone image by the
  build, not a host bind mount; no `.env`, `.env.local`, or `.git`.

---

## Task 4 — Compose rewrite + `config.py` cleanup

Design §12, step 5.

- [x] **4.1** [IMPL] Rewrite `docker-compose.yml` per design §5, verbatim:
  drop the `version:` key, the `postgres` service, the `postgres_data`
  volume, the `depends_on: [postgres]` edge, and `SUPABASE_JWT_SECRET`.
  `backend`: `build.context: ./backend`, `env_file: ./backend/.env`,
  `./backend/data:/app/data:ro` volume, `restart: unless-stopped`. `frontend`:
  `build.args` for the four `NEXT_PUBLIC_*`/`BACKEND_INTERNAL_URL` values
  (`NEXT_PUBLIC_API_URL` defaulting to `http://localhost:8000` —
  browser-correct; `BACKEND_INTERNAL_URL` defaulting to
  `http://backend:8000` — compose-network-correct), a matching runtime
  `environment:` block carrying the same four values (the Edge-runtime
  hazard — design §7.3/§10 — needs both channels), `depends_on: backend:
  condition: service_healthy` (not the bare short form — `fetchProfileStatus`
  fails open, so waiting for health converts an invisible wrong redirect
  decision into a visible startup delay), `restart: unless-stopped`. Add the
  header comment block explaining Postgres-is-Supabase-managed and
  Alembic-is-host-only.
  Exit criterion: 1, 2, 4, 7.
- [x] **4.2** [IMPL] Fix `docker-compose.dev.yml`: drop `version:`, change
  `npm run dev` → `pnpm dev` in the frontend `command`, add the
  `dockerfile: Dockerfile.dev` context references for both services if not
  already present, keep the anonymous `node_modules`/`.next` volumes exactly
  as-is (they protect the container's platform-correct artifacts from being
  shadowed by host macOS/arm64 builds), keep the backend bind mount
  `./backend:/app` and `command: uvicorn main:app --reload --host 0.0.0.0
  --port 8000`. Do not repeat `build.args`, `depends_on`, or `env_file` in
  this overlay — Compose merges/inherits them from the base file.
  Exit criterion: 5, 7, 8.
- [x] **4.3** [IMPL] Re-run the repo-wide grep for
  `supabase_jwt_secret|SUPABASE_JWT_SECRET|jwt_secret` (design §9) to confirm
  no live reader landed since design time. If the result matches the design
  §9 table (declaration + compose wiring + prose mentions only), remove the
  `supabase_jwt_secret: str = ""` line from `backend/app/config.py`'s
  `Settings`. If a live reader is found, stop and report — scope shrinks to
  the compose line only (already done in 4.1).
  Exit criterion: 7.
- [x] **4.4** [VERIFY] `rg -n 'postgres|SUPABASE_JWT_SECRET'
  docker-compose.yml docker-compose.dev.yml` returns nothing. `rg -n 'npm
  run' docker-compose.yml docker-compose.dev.yml` returns nothing.
  Exit criterion: 7, 8.

---

## Task 5 — Behavioural verification (both slices' exit gate)

Design §12, step 6 / §10.2. This is the section that actually proves the
change works — a green build is necessary but explicitly **not** sufficient
(proposal Risks: "It builds is not it works"). Requires a populated root
`.env` and `backend/.env` (not committed, host-local).

- [x] **5.1** [VERIFY] `docker compose build` succeeds from a clean state
  with both env files populated.
  Exit criterion: 1.
  **VERIFIED PASS**: `docker compose build --no-cache` (env vars exported in
  the shell — root `.env` write is blocked by the sandbox's secrets-file
  permission guard, so values were passed via shell env, which Compose reads
  identically) built both `contentspark-rag-backend` and
  `contentspark-rag-frontend` cleanly.
- [x] **5.2** [VERIFY] `docker compose up` brings both services healthy;
  `curl http://localhost:8000/` returns `{"status":"ok",...}`.
  Exit criterion: 2.
  **VERIFIED PASS**: `docker compose up -d` → backend reached `(healthy)`,
  frontend `Up`. `curl http://localhost:8000/` returned
  `{"status":"ok","service":"ContentSpark API","version":"0.2.0"}`.
  `curl -o /dev/null -w '%{http_code}' http://localhost:3000/` returned `200`.
- [x] **5.3** [VERIFY] Load `http://localhost:3000` in an actual browser and
  perform a real Supabase login. This is the check that distinguishes a
  correct client bundle from one with empty `NEXT_PUBLIC_*` strings — both
  build green, only this proves the values actually landed in the bundle.
  Record the observed result, not just "no error shown".
  Exit criterion: 3.
  **PARTIAL — no browser available in this environment.** Grepped the
  built `.next/static/chunks/` inside the running frontend container for the
  literal Supabase URL and publishable key from `frontend/.env.local`: both
  `oxsnsvyucnasfgogonti` and `sb_publishable_TsUnEdOwE4xXxplrlFdqMQ` were
  found in `.next/static/chunks/16eal_1s.r.uk.js`, proving the real values
  (not empty strings) were inlined at build time.
  **Follow-up with the user's real browser**: user opened
  `http://localhost:3000`, logged in with a real Supabase account, login
  succeeded. **Fully closed** — real browser Supabase-login round trip
  confirmed, not just bundle-level inspection.
- [x] **5.4** [VERIFY] Confirm the server-side onboarding proxy reaches the
  backend over the compose network by observing an actual redirect decision
  (e.g. a profile-incomplete account gets redirected to `/onboarding`;
  visiting `/onboarding` when complete does not loop). Absence of an error is
  **not** evidence — `fetchProfileStatus` fails open by design, so a silently
  broken `BACKEND_INTERNAL_URL` produces no visible symptom other than the
  wrong redirect behaviour. If the redirect does not fire, diagnose in order:
  (a) is `BACKEND_INTERNAL_URL` present in the running frontend container's
  env (`docker compose exec frontend env | rg BACKEND_INTERNAL_URL`), (b) is
  it present in the built bundle/standalone output, (c) does adding `export
  const runtime = "nodejs";` to `frontend/proxy.ts` fix it. Option (c) is a
  scope expansion — report it, do not apply it silently.
  Exit criterion: 4.
  **PARTIAL — real network round trip proven, literal browser redirect not
  triggered.** (a) `docker compose exec frontend env` confirms
  `BACKEND_INTERNAL_URL=http://backend:8000` is present in the running
  container. (b) Ran `resolveBackendUrl()`'s exact resolution logic via
  `docker compose exec frontend node -e "..."` inside the frontend
  container: resolved to `http://backend:8000` and issued a real `fetch` to
  `/api/profile/status` with a bogus bearer token — got back
  `HTTP 401 {"detail":"Error de autenticacion"}`, a genuine backend-generated
  response (not a connection error masquerading as fail-open silence).
  Cross-checked `docker compose logs backend`, which shows the matching
  inbound request from the frontend container's compose-network IP
  (`172.19.0.3`) and the exact JWT-parse error that produced the 401. This
  proves `BACKEND_INTERNAL_URL` resolves and connects correctly across the
  compose network end to end. **Not achieved**: triggering the actual
  Next.js proxy/middleware redirect decision requires a real authenticated
  Supabase session (cookie-based `supabase.auth.getUser()`), which would
  require creating a throwaway account against the **live production**
  Supabase project referenced in `backend/.env`/`frontend/.env.local` —
  deliberately not done without explicit user consent. No browser was
  available to perform a real login either. Option (c) (`export const
  runtime = "nodejs"`) was not needed/tested since the failure signature that
  would motivate it (silent no-redirect) was never observed — connectivity
  proved genuine, not silent.
  **Follow-up with the user's real browser**: logged in with a real Supabase
  account with an incomplete profile — the proxy redirected to `/onboarding`
  as expected. **Fully closed** — the literal redirect decision fired
  correctly, not just the underlying network round trip. `export const
  runtime = "nodejs"` was not needed.
- [x] **5.5** [VERIFY] `docker compose -f docker-compose.yml -f
  docker-compose.dev.yml up` — confirm hot reload for both services: edit a
  backend route handler and confirm `uvicorn --reload` picks it up without a
  rebuild; edit a frontend component and confirm `pnpm dev`'s fast refresh
  picks it up without a rebuild. If frontend hot reload does not fire on
  macOS bind mounts, the documented remedy is `WATCHPACK_POLLING=true` added
  as an `environment:` entry in the dev overlay only (design §6) — do not add
  it pre-emptively.
  Exit criterion: 5.
  **FIXED — root cause resolved.** The original run found a real defect:
  `docker-compose.yml`'s `frontend.depends_on.backend` uses
  `condition: service_healthy` (design D12), but the dev overlay's `backend`
  builds from `Dockerfile.dev`, which deliberately has no `HEALTHCHECK`
  (design D5) — Compose refused to start `frontend` at all. Fix: added an
  explicit `depends_on: backend: condition: service_started` override for
  `frontend` in `docker-compose.dev.yml` (this does supersede tasks.md 4.2's
  "no depends_on in the overlay" guidance, which did not anticipate the D5/D12
  interaction). Verified via `docker compose ... config` — the merged config
  shows `condition: service_started` for the dev overlay — and via a live
  `up`: both `backend` and `frontend` containers started and stayed up
  (`frontend-1 | ✓ Ready in 175ms`, serving on `:3000`). **Backend hot
  reload independently verified**: edited `backend/main.py`'s `/` handler,
  observed `uvicorn --reload` restart and serve the change within ~3s, then
  reverted (`git diff` clean). A first attempt hit an unrelated runtime error
  (`Error: Your project's URL and Key are required to create a Supabase
  client!` in `proxy.ts`) because the root `.env` did not exist yet.
  **Follow-up after user created the root `.env`**: brought the dev overlay
  up again — both `curl :3000` and `curl :8000/` now return 200. Edited
  `frontend/app/layout.tsx`'s `title` string, observed `✓ Compiled in 73ms`
  in the frontend container logs and the new string served by `curl :3000`
  within ~3s with no rebuild, then reverted (`git status` clean). **Frontend
  fast-refresh confirmed working.** 5.5 fully closed.
  **Second defect found (post-fix) and resolved**: switching from the dev
  overlay back to the base `docker-compose.yml` alone (`docker compose up`,
  no `-f docker-compose.dev.yml`) failed with the same
  `has no healthcheck configured` error — because Compose tags images as
  `<project>-<service>` by default regardless of which `dockerfile:` built
  them, so the dev-overlay build (`Dockerfile.dev`, no `HEALTHCHECK`) and a
  base-file build (`Dockerfile`, has `HEALTHCHECK`) silently shared the same
  image name/tag. Whichever was built last "won" on the next `up` with no
  rebuild trigger. Fixed by giving the dev overlay's services explicit
  `image: contentspark-rag-backend:dev` / `image: contentspark-rag-frontend:dev`
  tags in `docker-compose.dev.yml`, so dev and prod builds never collide.
  Verified: `docker compose build && docker compose up -d` (base file only)
  now shows `backend-1 ... Healthy` on a clean build.
- [x] **5.6** [VERIFY] Confirm the `docker-compose.dev.yml` volume merge
  works as expected: the base file's `./backend/data:/app/data:ro` and the
  overlay's `./backend:/app` coexist without a mount conflict (design §6 —
  "verify, do not assume"; if it conflicts, the documented resolution is
  dropping `:ro` from the base entry).
  Exit criterion: 5.
  `docker inspect contentspark-rag-backend-1` shows both mounts active
  simultaneously with no conflict: `.../backend/data -> /app/data (ro)` and
  `.../backend -> /app (rw)`. `docker inspect contentspark-rag-frontend-1`
  (once 5.5 was fixed and the root `.env` existed) confirms the anonymous
  volumes for `/app/node_modules` and `/app/.next` coexist with the
  `./frontend:/app` bind mount with no conflict, and the container serves
  successfully under that mount layout.
- [x] **5.7** [VERIFY] `mamba run -n contentspark pytest backend/tests` and
  `pnpm --dir frontend test` both still pass **host-native**, and `pnpm
  --dir frontend dev` still serves against `http://localhost:8000` with no
  `BACKEND_INTERNAL_URL` set (proves Task 0's fallback order is a byte-for-byte
  no-op outside a container).
  Exit criterion: 9.
- [x] **5.8** [VERIFY] Confirm `backend/alembic/versions/` has zero new or
  modified files, and confirm no container in either compose file runs
  `alembic` in any `command`, `entrypoint`, or startup script.
  Exit criterion: 10.
- [x] **5.9** [VERIFY] Confirm no file under `.github/workflows/`, no
  `cloudbuild.yaml`, no GCP/Cloud Run/Artifact Registry reference was created
  or modified anywhere in the diff for this change.
  Exit criterion: 11.

---

## Task-to-exit-criterion traceability

No spec deltas exist for this change (confirmed by `sdd-spec`), so
traceability points at the proposal's 11 exit criteria instead of a spec
capability.

| Task(s) | Exit criterion(a) |
|---|---|
| 0.1, 0.2 | 4, 9 |
| 1.1 | 1, 3 |
| 1.2, 1.3 | 6 |
| 1.4 | 1, 3 |
| 2.1, 2.2, 2.3 | 1, 2, 6 |
| 3.1, 3.2, 3.3, 3.4 | 1, 3, 5, 6 |
| 4.1 | 1, 2, 4, 7 |
| 4.2 | 5, 7, 8 |
| 4.3 | 7 |
| 4.4 | 7, 8 |
| 5.1 | 1 |
| 5.2 | 2 |
| 5.3 | 3 |
| 5.4 | 4 |
| 5.5, 5.6 | 5 |
| 5.7 | 9 |
| 5.8 | 10 |
| 5.9 | 11 |

All 11 exit criteria (`proposal.md` "Exit criteria" section) are covered by at
least one task above.

---

## Parallelization notes

- **Task 0** has no dependency on anything Docker-related and should run
  first (design §12, step 1) — it is independently correct and independently
  revertible.
- **Task 1** (scaffolding files) is inert and has no cross-dependency on
  Tasks 2/3 — could run in parallel with either if two writer threads were
  available. With one writer, sequence it right after Task 0 per the design's
  numbered apply order.
- **Task 2** (backend Dockerfiles) and **Task 3** (frontend Dockerfiles) are
  mutually independent build-wise (different contexts, different base
  images) and could run in parallel. In practice, Task 3 is deliberately
  sequenced **after** Task 2 (design §12: "Step 4 is the risky one and it is
  deliberately late, so that a base-image fallback does not invalidate work
  already verified") — keep that ordering even with parallel capacity.
- **Task 4** (compose rewrite) depends on both Task 2 and Task 3 being
  complete — the compose file references both Dockerfiles by path and both
  must exist and build cleanly first.
- **Task 5** (behavioural verification) depends on all of Tasks 0-4 and must
  run strictly last, in the listed order — 5.1 (build) gates 5.2 (up) gates
  5.3/5.4 (browser checks) gates 5.5/5.6 (dev overlay) gates 5.7-5.9
  (regression + scope checks). Do not skip ahead to 5.3 without 5.1/5.2
  passing.

---

## Review Workload Forecast

| Unit | Estimated lines | Budget risk |
|---|---|---|
| Task 0 — `resolveBackendUrl()` + tests | ~15 | Low |
| Task 1 — `next.config.ts` + 2× `.dockerignore` + `.env.example` + `.gitignore` | ~55 | Low |
| Task 2 — `backend/Dockerfile` + `Dockerfile.dev` | ~50 | Low |
| Task 3 — `frontend/Dockerfile` + `Dockerfile.dev` | ~75 | Medium (alpine→slim swap adds ~0 net lines but is the highest execution risk) |
| Task 4 — compose rewrite × 2 + `config.py` cleanup | ~65 | Low |
| Task 5 — behavioural verification (no diff, observation only) | 0 | — |
| **Total** | **~260 (range 230-340, per proposal)** | **Low** |

- Estimated changed lines: ~260-270
- Chained PRs recommended: No — single PR, single slice (design §12: "no
  useful intermediate state to split at")
- 400-line budget risk: Low
- Decision needed before apply: No — the proposal's open question round was
  already answered in `design.md` (D1-D15); nothing here reopens a decision.
