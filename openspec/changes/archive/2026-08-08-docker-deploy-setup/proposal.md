# Proposal: Containerize ContentSpark for Local Compose

**Modules affected**: repository root (`docker-compose.yml`, `docker-compose.dev.yml`,
`.env.example`), `backend/` (new `Dockerfile`, `Dockerfile.dev`, `.dockerignore`),
`frontend/` (new `Dockerfile`, `Dockerfile.dev`, `.dockerignore`, `next.config.ts`,
one server-side URL resolution fix).

## Intent

### The problem

The repository *claims* to be containerized and is not. `docker-compose.yml` declares
`build: ./backend` and `build: ./frontend`, and `docker-compose.dev.yml` declares
`dockerfile: Dockerfile.dev` for both services — but **zero Dockerfiles exist anywhere in
the repo**. `docker compose up --build` fails immediately on both files. The compose
files are aspirational scaffolding that has never run.

Beneath the missing Dockerfiles, both compose files have drifted away from what the
application actually is:

- **`docker-compose.yml` runs a `postgres:15-alpine` service** (lines 35-44) with
  `backend: depends_on: [postgres]` (line 22). The application does not use it. It
  connects to Supabase-managed Postgres through `DATABASE_URL`
  (`backend/app/config.py:23`), an external host. The local container is dead infra that
  costs a volume, a port binding, and — worse — teaches every future reader that
  ContentSpark has a local database of record.
- **`SUPABASE_JWT_SECRET` is still wired** (line 17). `CLAUDE.md` states this is obsolete:
  the backend verifies tokens by calling Supabase Auth with the `sb_secret_...` key, not
  by decoding JWTs. The variable survives in `Settings` (`config.py:20`) and in compose,
  signalling a security mechanism that no longer exists.
- **`docker-compose.dev.yml` runs `npm run dev`** (line 21). The project is pnpm-only:
  `pnpm@11.1.1` is pinned in `frontend/package.json:5`, `pnpm-lock.yaml` is the only
  lockfile present. `npm run dev` inside a pnpm-installed tree is at best a lockfile
  bypass and at worst a hard failure.
- **No `.dockerignore` exists anywhere**, so a naive build context sends `.git/`,
  `node_modules/`, `.next/`, `__pycache__/`, and — critically — `backend/.env` and
  `frontend/.env.local` into the image layer cache. Secrets in image layers is not a
  style issue.

Two failure modes are worse than "it doesn't build", because they produce an image that
builds *successfully* and is wrong:

1. **`NEXT_PUBLIC_*` is a build-time concern, not a runtime one.** `next build` inlines
   `process.env.NEXT_PUBLIC_*` into the client bundle. `docker-compose.yml` supplies them
   only as runtime `environment:` (lines 29-30). A Dockerfile written the obvious way
   produces a green build and ships a bundle with an empty Supabase URL and key — auth
   fails in the browser with no build-time signal at all.
2. **`NEXT_PUBLIC_API_URL` is read from two different network namespaces.** The browser
   reads it via `frontend/shared/lib/api-fetch.ts:3` (all chat/profile/calendar services)
   and needs `http://localhost:8000`. The Next.js server-side proxy reads the *same*
   variable via `frontend/shared/lib/profile-status.ts:9` and needs `http://backend:8000`.
   The current value `http://backend:8000` (`docker-compose.yml:31`) is unresolvable from
   a browser. And because `fetchProfileStatus` is deliberately fail-open
   (`profile-status.ts:22-27`, returns `null` on any failure), the wrong value in the
   other direction does not error — the onboarding redirect just silently stops working.

Finally, `frontend/next.config.ts` has no `output: "standalone"`, so any frontend image
must ship the full `node_modules` tree instead of the traced subset.

### Why now

Local containerization is the prerequisite for the GCP deployment work that follows. Every
defect above is cheaper to find on a laptop than on Cloud Run, where a silently-empty
`NEXT_PUBLIC_SUPABASE_ANON_KEY` presents as "login is broken in production" with no build
log to point at. The compose files also currently function as misinformation: a new
contributor reading them concludes there is a local Postgres and a JWT secret, and both
conclusions are false.

### Success

`docker compose up --build` from a clean clone brings up a working backend and frontend:
the frontend serves on `:3000`, the browser reaches the backend on `:8000`, auth works
because the Supabase keys are actually present in the client bundle, the server-side
onboarding proxy reaches the backend over the compose network, and no secret file is
present in any image layer. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`
gives hot reload for both services. Nothing in the repo references a local Postgres or a
JWT secret any more.

## Scope

### In Scope

- **`backend/Dockerfile`** — multi-stage, `python:3.11-slim` base, pip install from
  `backend/requirements.txt`, `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`
  (entrypoint is `backend/main.py`, not `app/main.py`). Non-root user. `HEALTHCHECK`
  against the existing `GET /` health endpoint (`backend/main.py:44-47`).
- **`backend/Dockerfile.dev`** — the target `docker-compose.dev.yml` already names.
  Single-stage, dependencies installed, `--reload` supplied by the compose `command`.
- **`frontend/Dockerfile`** — multi-stage (deps → build → runner) on `node:20-alpine`
  (`engines.node: ">=20"`), pnpm via corepack pinned to `pnpm@11.1.1`,
  `pnpm install --frozen-lockfile`. Declares `ARG NEXT_PUBLIC_SUPABASE_URL`,
  `ARG NEXT_PUBLIC_SUBABASE_ANON_KEY`, `ARG NEXT_PUBLIC_API_URL` and promotes them to
  `ENV` **before** `pnpm build`. Runner stage copies `.next/standalone`, `.next/static`,
  and `public/` (4 assets present). Non-root user.
- **`frontend/Dockerfile.dev`** — pnpm-based, `pnpm dev` via compose `command`.
- **`frontend/next.config.ts`** — add `output: "standalone"`.
- **`.dockerignore` for `backend/` and `frontend/`** — at minimum `.git`, `.env*`,
  `node_modules`, `.next`, `__pycache__`, `*.pyc`, `.venv`, test caches.
- **`docker-compose.yml` rewrite** — remove the `postgres` service, its volume, and the
  `depends_on` (user decision, already made); remove `SUPABASE_JWT_SECRET`; use
  `env_file: ./backend/.env` for backend runtime config; add `build.args` for the frontend
  `NEXT_PUBLIC_*` values; correct the API URL split (see Approach 4); drop the obsolete
  `version:` key.
- **`docker-compose.dev.yml` fixes** — `npm run dev` → `pnpm dev`; keep the anonymous
  `node_modules`/`.next` volumes; align with the rewritten base file.
- **One frontend code change**: `profile-status.ts` reads a server-only
  `BACKEND_INTERNAL_URL` first, falling back to `NEXT_PUBLIC_API_URL`, then
  `http://localhost:8000`. Required to resolve the dual-namespace conflict (see
  Approach 4).
- **Root `.env.example`** documenting only the variables compose itself must interpolate
  (the three `NEXT_PUBLIC_*` build args), plus a short README-level note on where the two
  real env files live.
- **Removal of `supabase_jwt_secret` from `backend/app/config.py`** — see Decisions, item 3.

### Out of Scope

- **The actual GCP deployment.** No Cloud Run vs. GKE vs. Compute Engine decision, no
  `cloudbuild.yaml`, no Artifact Registry push, no `gcloud` anything. That is a separate
  change that starts once this one is verified locally.
- **CI/CD.** `.github/workflows/ci.yml` and `deploy.yml` are not touched. No image build
  in CI.
- **Domains, TLS, ingress, reverse proxy.** No nginx/Traefik/Caddy service.
- **The CORS allow-list** (`backend/main.py:29-34`). `http://localhost:3000` already
  covers the compose browser origin; the `https://contentspark.com` entry is a deploy-time
  concern.
- **Running Alembic migrations from the container.** See Decisions, item 4.
- **Containerizing n8n, Qdrant, or any other dependency.** All are managed/cloud services
  reached over the network.
- **Image size optimization beyond what multi-stage naturally gives**, layer-cache tuning,
  BuildKit cache mounts, or multi-arch builds.
- **Production secret management** (Secret Manager, mounted secrets, `--secret` mounts).
  Local compose reads local env files.
- **`docker compose` support for the `mamba` env.** The `contentspark` mamba env stays a
  host-only convention; no conda/mamba layer in any image.

## Approach

1. **Multi-stage for both services, not a minimal patch.** The alternative — write the two
   smallest Dockerfiles that satisfy the existing compose files — leaves the dead postgres,
   the stale JWT secret, the npm/pnpm mismatch, the missing `.dockerignore`, and the
   build-arg gap all in place, and produces a stack that comes up but is wrong in ways
   that only surface later. The defects are entangled: you cannot fix the
   `NEXT_PUBLIC_*` gap without touching both the Dockerfile and the compose file, and you
   cannot honestly ship a `.dockerignore`-less build that bakes `.env` into a layer. Fix
   them as one coherent unit.

2. **pip in `python:3.11-slim`, never mamba.** The `contentspark` mamba env is a host
   developer convention (project memory + `openspec/project.md`), and no mamba/conda
   reference exists anywhere under `backend/`. Reproducing it in a container would add
   hundreds of megabytes and a second dependency resolver for zero benefit;
   `requirements.txt` is already the real contract. Note `tzdata` is already pinned in
   `requirements.txt:44` specifically because slim images lack system tzdata — the
   dependency list already anticipates this base image.

3. **`NEXT_PUBLIC_*` as build ARGs, promoted to ENV before `next build`.** This is the
   only mechanism that works; runtime `environment:` cannot retroactively enter a bundle
   that `next build` already emitted. Compose supplies them through `build.args` with
   `${VAR}` interpolation, which reads the shell or a root `.env` — hence the root
   `.env.example`. Runtime `environment:` is kept as well for the server-side half of the
   app, which reads them at request time.

4. **Split the browser URL from the server-internal URL.** One variable cannot be both
   `http://localhost:8000` (browser) and `http://backend:8000` (compose network). The
   options were: (a) leave it and accept the onboarding proxy silently failing open —
   rejected, that is exactly the class of defect this change exists to remove; (b) publish
   the backend and have the frontend container reach it through the host — fragile and
   platform-dependent; (c) introduce `BACKEND_INTERNAL_URL`, read only by the server-side
   `profile-status.ts`, defaulting to `NEXT_PUBLIC_API_URL` when unset. (c) is a
   three-line change, is a no-op for host-native `pnpm dev`, and makes the two namespaces
   explicit instead of accidentally-equal. `NEXT_PUBLIC_API_URL` becomes
   `http://localhost:8000` (browser-correct); `BACKEND_INTERNAL_URL` becomes
   `http://backend:8000`.

5. **`env_file:` per service instead of root-`.env` interpolation for runtime config.**
   The real env files already live at `backend/.env` and `frontend/.env.local`;
   `env_file: ./backend/.env` consumes the backend one directly with zero duplication and
   zero new files to keep in sync. Only the frontend build args genuinely cannot use
   `env_file` (Compose does not source build args from env files), so only those three
   values appear in the root `.env.example`. This keeps duplication at three variables
   rather than the full set.

6. **`output: "standalone"` in `next.config.ts`.** Without it the runner stage must carry
   the entire `node_modules` tree. With it, Next traces the actual dependency set and the
   runner copies three directories. This does change host-native `pnpm build` output
   layout (it additionally emits `.next/standalone`), but `pnpm dev` and `pnpm start` are
   unaffected.

## Decisions

**1. The local `postgres` service — removed (user decision, already made).**
The application's Postgres is Supabase-managed and reached via `DATABASE_URL`. Keeping a
local container that nothing connects to would mean the stack has a database that is
never written to and a `depends_on` that gates startup on an irrelevant service. Removed
along with the `postgres_data` volume and the `depends_on: [postgres]` edge. Consequence
accepted: `docker compose up` requires network access to Supabase; there is no offline
mode, which matches how the app already works outside Docker.

**2. Non-root users and a healthcheck — included, despite exploration deferring them.**
Exploration proposed deferring both to the GCP phase. They are ~2 lines each, the health
endpoint already exists (`backend/main.py:44`), and Next.js standalone already expects to
run as a non-root `nextjs` user by convention. Deferring means rewriting both Dockerfiles
later for something that costs four lines now. Cost is trivial; the reason to defer was
not.

**3. `SUPABASE_JWT_SECRET` — removed from compose *and* from `Settings`.**
It is dead in both places: `config.py:20` declares `supabase_jwt_secret: str = ""` and
nothing reads it. Removing it from compose alone leaves the field in `Settings`, where the
next reader will re-add the compose wiring to "fix" the empty value. This is a two-line
deletion; it is in scope precisely because it is otherwise a trap. If a `grep` at apply
time finds a live reader, the field stays and only the compose line goes.

**4. Alembic migrations — not run by the container.**
No entrypoint script, no `alembic upgrade head` on start. The Supabase database is shared
and already migrated; having every container start race to migrate a shared production-ish
database is a worse default than running migrations deliberately from the host, which is
what `CLAUDE.md` already prescribes. This is documented in the compose file as a comment,
not left implicit.

**5. `frontend/.env.local` is not read by compose.**
Next.js reads `.env.local` at build time from the build context, but `.dockerignore`
excludes `.env*` (correctly — it must not enter a layer). So the frontend's values reach
the image *only* through build args. This is deliberate and must be documented, because
the failure mode of forgetting it is a silently empty bundle rather than an error.

**6. The obsolete `version: '3.9'` key — dropped.**
Compose v2 ignores it and warns. Both files lose it.

## Affected capabilities (delta specs required)

**None.** This change adds no user-facing behaviour, no API surface, and no business rule.
It is build/infrastructure work plus one three-line source change
(`profile-status.ts` URL resolution) whose observable behaviour is unchanged outside a
container. `sdd-spec` should confirm this rather than manufacture a capability; if it
concludes the `BACKEND_INTERNAL_URL` resolution deserves a requirement, the natural home
is a short addition to whichever capability owns the onboarding redirect, not a new one.

## Risks

- **"It builds" is not "it works".** The single highest-value verification is not
  `docker compose build` succeeding but loading `http://localhost:3000` in a browser and
  confirming a real Supabase login round-trip. An image with empty `NEXT_PUBLIC_*` values
  builds green. Exit criteria must be behavioural, not build-status.
- **`pnpm install --frozen-lockfile` on Node 20 alpine may hit native-build issues.**
  `frontend/package.json:37-42` explicitly allows builds for `sharp` and `unrs-resolver`.
  Alpine's musl libc is the usual place `sharp` fails. If it does, the fallback is
  `node:20-slim` (Debian) at the cost of image size. This must be verified by an actual
  build, not assumed.
- **`output: "standalone"` changes build output and may interact with the root-level
  `proxy.ts`.** Next.js 16's `proxy.ts` (the middleware successor) lives at
  `frontend/proxy.ts`; standalone tracing must include it and its `profile-status`
  dependency. If tracing misses it, the onboarding redirect silently stops working — the
  same fail-open blind spot noted above. Worth an explicit check.
- **Removing `supabase_jwt_secret` from `Settings` could break an unseen reader.**
  Mitigated by a `grep` at apply time; if a reader exists, scope shrinks to the compose
  line only.
- **Node 20 vs. Next.js 16.** `engines.node: ">=20"` permits 20, but Next 16 and React 19
  are recent; if a build-time incompatibility appears, moving to `node:22-alpine` is the
  fix and is still within `engines`.
- **The root `.env.example` introduces a third env-file location.** Three variables now
  live in two places (`frontend/.env.local` for host dev, root `.env` for compose builds).
  Drift between them produces a stale bundle. Documented duplication is the accepted cost
  of Compose not sourcing build args from env files.
- **No exit criterion can prove the GCP deploy will work.** This change deliberately stops
  at local parity. A locally-green stack is necessary but not sufficient for Cloud Run,
  which adds its own port, listening-address, and secret constraints.

## Changed-line estimate (review budget: 400)

| Area | Est. additions + deletions |
|---|---|
| `backend/Dockerfile` | ~30 |
| `backend/Dockerfile.dev` | ~20 |
| `backend/.dockerignore` | ~20 |
| `frontend/Dockerfile` (multi-stage + build args) | ~55 |
| `frontend/Dockerfile.dev` | ~20 |
| `frontend/.dockerignore` | ~20 |
| `frontend/next.config.ts` | ~2 |
| `frontend/shared/lib/profile-status.ts` | ~4 |
| `docker-compose.yml` (rewrite: -14 postgres/JWT, +new wiring) | ~50 |
| `docker-compose.dev.yml` | ~15 |
| Root `.env.example` | ~12 |
| `backend/app/config.py` (drop `supabase_jwt_secret`) | ~2 |
| Docs note (CLAUDE.md or README on compose usage) | ~20 |
| **Total** | **~270 (range 230–340)** |

**Decision needed before apply: Yes** (see Proposal question round)
**Chained PRs recommended: No**
**400-line budget risk: Low**

The estimate sits comfortably under budget with room for an alpine→slim base-image
fallback. Single PR.

### Note on `strict_tdd`

`openspec/config.yaml` sets `strict_tdd: true`. Almost all of this change is
non-unit-testable infrastructure (Dockerfiles, compose YAML). The one exception is the
`profile-status.ts` URL resolution change, which is directly testable and should get a
test asserting the `BACKEND_INTERNAL_URL` → `NEXT_PUBLIC_API_URL` → default precedence
(`frontend/shared/lib/profile-status.test.ts` already exists). Verification for everything
else is an actual `docker compose up --build` plus a browser check, not pytest/vitest.
`sdd-tasks` should encode that explicitly rather than pretending the Dockerfiles have unit
tests.

## Exit criteria

1. `docker compose build` succeeds from a clean clone with a populated root `.env` and
   `backend/.env`.
2. `docker compose up` brings both services healthy; `GET http://localhost:8000/` returns
   `{"status":"ok",...}`.
3. Loading `http://localhost:3000` in a browser performs a real Supabase auth round-trip —
   proving `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are present in the client bundle, not
   empty strings.
4. The server-side onboarding proxy reaches the backend over the compose network
   (`BACKEND_INTERNAL_URL`), verified by an actual redirect decision rather than by the
   absence of an error — `fetchProfileStatus` fails open, so silence is not evidence.
5. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` gives working hot
   reload for both backend (`--reload`) and frontend (`pnpm dev`), with host edits
   reflected without a rebuild.
6. `docker run --rm <frontend-image> ls -a` (or equivalent layer inspection) shows no
   `.env`, `.env.local`, `node_modules` from the host, or `.git` in either image.
7. `rg -n 'postgres|SUPABASE_JWT_SECRET' docker-compose.yml docker-compose.dev.yml`
   returns nothing.
8. `rg -n 'npm run' docker-compose*.yml` returns nothing.
9. Host-native workflows are unregressed: `mamba run -n contentspark pytest backend/tests`
   and `pnpm --dir frontend test` both still pass, and `pnpm --dir frontend dev` still
   serves against `http://localhost:8000` with no `BACKEND_INTERNAL_URL` set.
10. No file under `backend/alembic/versions/` is added or modified; no migration runs from
    any container.
11. No GCP, Cloud Run, Artifact Registry, or CI/CD file is created or modified.

## Proposal question round

**Status: OPEN — awaiting user answers before `sdd-spec` and `sdd-design` run.**

The assumptions below are what the proposal currently encodes. Answer, correct, skip, or
ask for a second round.

1. **The `NEXT_PUBLIC_API_URL` split.** One variable is read from two network namespaces:
   the browser (needs `localhost:8000`) and the Next.js server proxy (needs
   `backend:8000`). Resolving it means one small source change in
   `frontend/shared/lib/profile-status.ts` — this proposal is not purely infrastructural
   because of it. **Assumption**: introduce a server-only `BACKEND_INTERNAL_URL`,
   defaulting to `NEXT_PUBLIC_API_URL` so host-native dev is unaffected. Acceptable, or do
   you want this change to touch zero application source and accept that the onboarding
   redirect silently no-ops inside Docker?

2. **Root `.env` for build args.** Compose cannot source `build.args` from an `env_file`,
   so the three `NEXT_PUBLIC_*` values must be duplicated from `frontend/.env.local` into
   a root `.env` for docker builds. **Assumption**: accept three duplicated variables plus
   a committed `.env.example`, rather than moving all env files to the repo root (which
   would change the host-native dev workflow every existing script assumes).

3. **`SUPABASE_JWT_SECRET` removal depth.** It is dead in compose *and* in
   `backend/app/config.py:20`. **Assumption**: remove both, so the field cannot invite a
   future "fix" that rewires the compose variable. Or keep `Settings` untouched and only
   clean the compose file, keeping this change strictly infrastructural?

4. **Alembic in the container.** **Assumption**: no migrations run from any container;
   `alembic upgrade head` stays a deliberate host command against the shared Supabase
   database. Or do you want a documented one-shot `migrate` compose profile you can invoke
   explicitly (`docker compose run --rm migrate`)?

5. **Dev-image fidelity.** `docker-compose.dev.yml` bind-mounts the source and runs
   `--reload` / `pnpm dev`. **Assumption**: the dev images stay deliberately simple
   (single-stage, root user, no healthcheck) because they exist for iteration, not for
   parity with the production image. Or should the dev path be dropped entirely in favour
   of host-native `pnpm dev` + `uvicorn --reload`, leaving only the production compose
   file?
