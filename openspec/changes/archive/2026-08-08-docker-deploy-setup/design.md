# Design: Containerize ContentSpark for Local Compose

**Change**: `docker-deploy-setup`
**Input**: `openspec/changes/docker-deploy-setup/proposal.md` (authoritative). Its six
Approach items and six Decisions are **settled and implemented here, not reopened**. All
five questions in the proposal question round were answered with the recommended option;
they are recorded as D1-D5 in §12 and treated as constraints.

---

## 0. Architecture stance

This change has no runtime architecture in the application sense. What it has is a **build
graph** and an **environment-variable topology**, and every real defect the proposal names
is a defect in one of those two, not in application code.

Two commitments shape the whole document:

1. **The build graph is the design.** Each image is a small DAG of stages whose only job is
   to keep two things out of the final layer: build tooling, and secrets. Every stage
   boundary in §1 and §3 exists for one of those two reasons. No stage exists for image-size
   aesthetics — that is explicitly out of scope.

2. **Environment variables have a *namespace* and a *phase*, and the current repo conflates
   both.** Phase: build-time (inlined by `next build`) vs. runtime (read by a process).
   Namespace: browser vs. compose-internal network. The entire class of "builds green, is
   wrong" failure comes from a variable being correct in one axis and wrong in the other.
   §7 makes both axes explicit; §12/D2 records the resolution.

There is exactly **one** application source change (`profile-status.ts`). It is designed in
§7 with more care than its four lines suggest, because it is the only part of this change
that unit tests can reach, and because it sits behind a deliberately fail-open path where a
wrong value produces silence rather than an error.

---

## 1. `backend/Dockerfile` — multi-stage, pip, non-root

### Stage graph

```
python:3.11-slim  ──► builder ──► runtime
                      (pip install into /opt/venv)
                                   (copy /opt/venv + app source)
```

Two stages, one boundary, one reason: `pip` and its build byproducts (wheel caches,
transient `gcc` if any sdist needs it) must not reach the runtime layer. A virtualenv at
`/opt/venv` is the transfer unit because it is a single self-contained directory that
`COPY --from` moves atomically, and because it avoids the `--user`/`~/.local` path games
that break the moment the runtime user differs from the build user (and here it does).

```dockerfile
# ---------- builder ----------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Usuario sin privilegios: el proceso nunca corre como root.
RUN groupadd --system --gid 1001 appuser \
 && useradd --system --uid 1001 --gid appuser --create-home appuser

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=appuser:appuser . .

USER appuser
EXPOSE 8000

# El endpoint existe en main.py:44 (GET / -> {"status":"ok",...}).
# Se usa urllib en vez de curl porque la imagen slim no trae curl y
# agregarlo solo para el healthcheck es una capa de mas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Load-bearing details

- **`main:app`, not `app.main:app`.** The ASGI entrypoint is `backend/main.py:21`
  (`app = FastAPI(...)`). `backend/app/` is a *package*, not the module. `WORKDIR /app`
  plus `COPY . .` puts `main.py` at `/app/main.py` and the package at `/app/app/`, so
  `uvicorn main:app` resolves and `from app.routers import ...` (`main.py:8`) resolves too.
  Getting this backwards produces `ModuleNotFoundError` at container start, not at build.
- **`PYTHONUNBUFFERED=1` is not cosmetic.** The project convention is "logging con prints
  descriptivos" (`CLAUDE.md`) and every LangGraph node prints. Without it those prints sit
  in a 4 KB buffer and `docker compose logs` looks like the service is hung.
- **No `curl`/`wget` install.** See the healthcheck comment above. The `python` binary is
  already on `PATH` from the venv.
- **`--start-period=20s`.** The app imports LangChain, LangGraph, Qdrant, and Supabase
  clients at module scope; cold import is seconds, not milliseconds. A short start period
  would mark the container unhealthy during normal boot and, with the
  `condition: service_healthy` dependency in §5, would stall the frontend.
- **No `EXPOSE`-only assumption**: the port is bound explicitly in `CMD` via `--host 0.0.0.0`,
  because a container that listens on `127.0.0.1` is unreachable from the compose network.
  This is also the single constraint most likely to matter later on Cloud Run.
- **No entrypoint script, no Alembic.** Per proposal Decision 4 / D4 below. The compose
  file carries a comment saying so; the Dockerfile stays silent rather than carrying a
  disabled migration hook that invites re-enabling.
- **`tzdata` is already in `requirements.txt:44`** with an inline comment explaining that
  slim images lack the system tree. That entry was added by `creator-timezone` in
  anticipation of exactly this base image. Nothing to do; do not remove it.

### What is *not* copied

`.dockerignore` (§4) removes `data/` from the build context. The ten PDFs under
`backend/data/` are inputs to the `ingest_data.py` CLI, not to the API process — no router
or service reads them. They reach the container through the compose bind mount instead
(§5), so ingestion still works while the image stays free of ~tens of MB of corpus.

---

## 2. `backend/Dockerfile.dev` — single stage, deliberately

Per D5, dev images are for iteration, not for parity. Single stage, root user, no
healthcheck, no venv indirection.

```dockerfile
# Imagen de desarrollo: single-stage, root, sin healthcheck.
# Es deliberado (design D5) — el codigo llega por bind mount y el
# comando (--reload) lo pone docker-compose.dev.yml.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
```

The dependency install is a separate layer *above* any source copy so that editing source
never invalidates it — but note there is no source `COPY` at all: `docker-compose.dev.yml`
bind-mounts `./backend:/app` over the whole directory. Copying source here would be dead
weight that the mount immediately shadows. The `CMD` duplicates the compose `command` on
purpose, so `docker run` on this image alone still does the useful thing.

**Root user here is a considered choice, not an oversight.** The bind-mounted host files are
owned by the host UID; a non-root container user would hit permission errors writing
`__pycache__` and `.pytest_cache` into the mount. Dev image, dev tradeoff, documented in the
file header so it does not get "fixed" into the production Dockerfile.

---

## 3. `frontend/Dockerfile` — deps → builder → runner

### Stage graph and why three, not two

```
node:20-alpine ──► deps    (pnpm install --frozen-lockfile)
               ──► builder (deps' node_modules + source + ARGs -> pnpm build)
               ──► runner  (.next/standalone + .next/static + public/ only)
```

`deps` is separate from `builder` so that a source edit does not re-run
`pnpm install`. `runner` is separate from `builder` so that the full `node_modules`, the
source tree, and — critically — the build ARGs' shell history never exist in the shipped
layer.

```dockerfile
# ---------- deps ----------
FROM node:20-alpine AS deps
# libc6-compat: musl vs glibc para binarios nativos (sharp, unrs-resolver).
# Si aun asi falla el install, la salida documentada es node:20-slim (ver design §3.3).
RUN apk add --no-cache libc6-compat

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app
# .npmrc y pnpm-workspace.yaml son parte del contrato de resolucion:
# minimum-release-age, auto-install-peers y allowBuilds viven ahi.
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build INLINEA estos valores en el bundle del cliente. Si no estan
# presentes en ESTE stage, la imagen compila verde y el navegador recibe
# strings vacios: auth rota sin ninguna senal en el build log.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Los 4 assets de public/ (incluye un nombre con espacio: "logo_content .png").
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# standalone trae server.js + el subconjunto trazado de node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# static NO viene dentro de standalone: hay que copiarlo aparte o el
# sitio carga sin CSS ni JS de cliente.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Cache escribible por el usuario no-root (imagenes/ISR).
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

### 3.1 The three details that silently break this image

1. **`HOSTNAME=0.0.0.0`.** The Next.js standalone `server.js` defaults to `localhost`.
   Inside a container that means the port publishes but nothing answers. This is the
   frontend twin of `uvicorn --host 0.0.0.0` and is equally non-negotiable.
2. **`.next/static` is copied separately.** `output: "standalone"` deliberately excludes it
   because Vercel serves it from a CDN. Omit the copy and the app returns HTML with 404s on
   every asset — a page that renders unstyled, not an error.
3. **`.npmrc` and `pnpm-workspace.yaml` are copied into `deps`.** `frontend/.npmrc` sets
   `minimum-release-age=10080` (a supply-chain guard) and `auto-install-peers`;
   `frontend/pnpm-workspace.yaml` carries `allowBuilds` for `sharp`/`unrs-resolver`. Copy
   only `package.json` + lockfile and the container install silently uses different rules
   than the host — which is exactly the reproducibility hole this change exists to close.

### 3.2 `next.config.ts`

```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

**Standalone tracing must include `proxy.ts` and its import graph.** `frontend/proxy.ts`
imports `fetchProfileStatus` from `@/shared/lib/profile-status`; if tracing misses it, the
onboarding redirect stops working *silently*, because `fetchProfileStatus` fails open
(`profile-status.ts:26-28`). Next traces middleware/proxy by design, so the expected outcome
is "works", but the verification for it is behavioural (exit criterion 4), not "the build
succeeded". This is called out again in §11.

### 3.3 The alpine → slim fallback, as a *procedure*

The proposal flags `sharp`/`unrs-resolver` native builds under musl as the top build risk.
This design does **not** pre-emptively switch to Debian — that would trade a real
verification for an assumption in the opposite direction. Instead:

| Step | Action |
|---|---|
| 1 | Build with `node:20-alpine` + `libc6-compat` as written. |
| 2 | If `pnpm install --frozen-lockfile` or `pnpm build` fails with a native/musl error (`Error relocating`, `sharp` prebuild not found, `unrs-resolver` binding load failure), **do not** patch with per-package workarounds. |
| 3 | Swap all three `FROM node:20-alpine` → `FROM node:20-slim` and delete the two `apk add --no-cache libc6-compat` lines. Nothing else in the file changes. |
| 4 | Record which base actually shipped, and the error text if the swap happened, in the change's verification notes. |

The Dockerfile is written so this swap is a four-line mechanical edit with no structural
consequence — that is the point of putting `libc6-compat` on its own line in each stage.

Secondary fallback, per the proposal's Node/Next risk: if the failure is a Node-version
incompatibility rather than a libc one, `node:22-alpine` is still inside
`engines.node: ">=20"` and is the correct move. Diagnose which of the two it is before
swapping; they have different error signatures.

---

## 4. `backend/Dockerfile.dev`'s frontend twin, and both `.dockerignore` files

### `frontend/Dockerfile.dev`

```dockerfile
# Imagen de desarrollo: single-stage, root, sin healthcheck (design D5).
FROM node:20-alpine
RUN apk add --no-cache libc6-compat

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "dev"]
```

The install happens **at image build**, not at container start, because the anonymous
`/app/node_modules` volume in `docker-compose.dev.yml` seeds itself from the image layer the
first time it is created. Skip the install here and the volume seeds empty and `pnpm dev`
fails on a missing `next` binary.

If the alpine swap of §3.3 happens, apply it here too — the two files must not diverge on
base image.

### `.dockerignore`

Both files exist for one primary reason (keep `.env*` out of every layer) and one secondary
(keep the build context small enough that context upload is not the slowest part of the
build).

`backend/.dockerignore`:

```
.env
.env.*
__pycache__/
*.py[cod]
*.pyo
.venv/
venv/
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
*.egg-info/
data/
tests/
Dockerfile*
.dockerignore
```

`frontend/.dockerignore`:

```
.env
.env.*
node_modules/
.next/
out/
build/
coverage/
.pnpm-store/
*.tsbuildinfo
.vercel/
Dockerfile*
.dockerignore
README.md
```

Notes, because two of these entries are easy to get wrong:

- **`node_modules/` and `.next/` in the frontend ignore file are mandatory, not tidiness.**
  A host `node_modules` built on macOS/arm64 copied into a Linux image produces native
  binaries for the wrong platform, and the failure is at *runtime*, deep inside `sharp`.
- **`data/` is excluded from the backend image** (§1). If a later change needs the corpus
  inside the image (e.g. a containerized ingestion job), that is a deliberate reversal, not
  an oversight to correct silently.
- **`tests/` is excluded from the backend image** but note tests are run host-native
  (`mamba run -n contentspark pytest backend/tests`) per project convention; the container
  is not a test runner in this change.
- `.git` needs no entry: Docker excludes it from the context by default in current
  versions, and neither service's build context is the repo root anyway (contexts are
  `./backend` and `./frontend`, so `.git` is not even in scope). Adding it would be harmless
  but misleading about where the risk is.

---

## 5. `docker-compose.yml` — full rewrite

```yaml
# ContentSpark — stack local.
#
# Postgres NO vive aqui: la base de datos es la de Supabase y se alcanza
# por DATABASE_URL (backend/app/config.py). No hay modo offline.
#
# Las migraciones de Alembic NO corren desde ningun contenedor (design D4).
# Se ejecutan a mano desde el host contra la base compartida:
#   mamba run -n contentspark alembic upgrade head
#
# Variables:
#   - backend  -> se leen de ./backend/.env via env_file (runtime).
#   - frontend -> los NEXT_PUBLIC_* deben existir en un .env en la raiz
#     del repo porque Compose NO puede alimentar build.args desde env_file,
#     y next build los inlinea en el bundle. Ver .env.example.

services:
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      # Corpus de ingesta: no va dentro de la imagen (.dockerignore),
      # llega por montaje de solo lectura para `python ingest_data.py`.
      - ./backend/data:/app/data:ro
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        # El navegador resuelve esto: DEBE ser localhost, no backend.
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}
        # El servidor de Next (proxy.ts) resuelve esto: red de compose.
        BACKEND_INTERNAL_URL: ${BACKEND_INTERNAL_URL:-http://backend:8000}
    ports:
      - "3000:3000"
    environment:
      # Runtime, para la mitad server-side de la app. Los NEXT_PUBLIC_*
      # del bundle del cliente ya quedaron fijados en build.args.
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
      - BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL:-http://backend:8000}
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
```

### Decisions inside this file

- **No `version:` key** (proposal Decision 6). Compose v2 warns on it.
- **No `postgres` service, no `postgres_data` volume, no `depends_on: [postgres]`**
  (proposal Decision 1).
- **No `SUPABASE_JWT_SECRET`** (proposal Decision 3, and §10).
- **`env_file: ./backend/.env` replaces nine `${VAR}` lines.** Zero duplication and zero new
  files to keep in sync — the file already exists and is already the backend's contract.
  Compose fails loudly if it is missing, which is the right behaviour for a service that
  cannot function without Supabase and Groq credentials.
- **`depends_on: condition: service_healthy`, not the bare short form.** The backend
  healthcheck exists (§1), and the frontend's first server-side `fetchProfileStatus` fails
  *open* — so a frontend that boots before the backend is ready does not error, it silently
  skips an onboarding redirect. Waiting for health converts an invisible wrong answer into
  a visible short startup delay. This is the same fail-open blind spot the proposal names,
  addressed at the orchestration layer rather than only in code.
- **`data` mounted `:ro`.** The container has no reason to write into the host corpus.
- **`restart: unless-stopped`** on both: a crash during a Supabase blip should recover
  without manual intervention, and the flag has no cost when the stack is stopped
  deliberately.

---

## 6. `docker-compose.dev.yml` — overlay

```yaml
# Override de desarrollo: hot reload por bind mount.
# Uso: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
#
# Las imagenes .dev son single-stage y corren como root a proposito
# (design D5): existen para iterar, no para parecerse a produccion.

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend:/app
    command: uvicorn main:app --reload --host 0.0.0.0 --port 8000

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend:/app
      # Volumenes anonimos: protegen los artefactos del contenedor de ser
      # tapados por los del host (node_modules de macOS/arm64 romperia sharp).
      - /app/node_modules
      - /app/.next
    command: pnpm dev
```

Changes from the current file: `version:` dropped, `npm run dev` → `pnpm dev`. The anonymous
volumes are kept exactly as-is (proposal, In Scope) and the comment explains why they are
load-bearing rather than incidental.

**Two overlay behaviours worth naming, because they are not obvious:**

- The overlay does **not** repeat `build.args`. Compose merges `build` maps, so the base
  file's `args` still apply to the dev image. That is harmless: `Dockerfile.dev` declares no
  matching `ARG`, so Docker ignores them with a warning at most. Redeclaring them here would
  be duplication with no effect.
- The overlay does **not** repeat `depends_on` or `env_file`; both are inherited from the
  base file. Backend hot reload therefore still gets `./backend/.env`.
- The base file's backend `volumes` entry (`./backend/data:/app/data:ro`) and the overlay's
  (`./backend:/app`) are **merged, not replaced** — Compose concatenates list-valued keys.
  The read-only `data` mount lands inside the read-write `/app` mount. Docker applies the
  more specific mount point, so this works, but if it produces a mount conflict at apply
  time, the resolution is to drop the `:ro` data mount from the *overlay*'s perspective by
  making the base entry `./backend/data:/app/data` without `:ro`. Verify, do not assume.

**Hot reload on macOS bind mounts** can miss filesystem events. If exit criterion 5 fails
for the frontend specifically, the documented remedy is `WATCHPACK_POLLING=true` (and, for
the backend, `uvicorn --reload --reload-delay`) added as an `environment:` entry in this
overlay only. Do not add it pre-emptively; polling burns CPU continuously.

---

## 7. `frontend/shared/lib/profile-status.ts` — the one source change

### 7.1 The two axes, made explicit

| Reader | File | Runs in | Needs |
|---|---|---|---|
| Browser (chat/profile/calendar services) | `shared/lib/api-fetch.ts:3` | Browser | `http://localhost:8000` |
| Next server proxy (onboarding gate) | `shared/lib/profile-status.ts:9` | Container | `http://backend:8000` |

One variable cannot be both. Per D1, a server-only `BACKEND_INTERNAL_URL` is introduced,
read *only* by `profile-status.ts`, falling back to `NEXT_PUBLIC_API_URL` and then to
`http://localhost:8000`. `api-fetch.ts` is **not touched** — it is browser-only and its
current resolution is already correct.

### 7.2 Resolve per call, not at module load

Current code (`profile-status.ts:9`) is a module-level `const`. Keeping that shape makes the
precedence rule untestable without `vi.resetModules()` gymnastics in every test, and makes
the value un-overridable at runtime. The change extracts a function:

```ts
// Resolucion de URL del backend, en orden de precedencia:
//   1. BACKEND_INTERNAL_URL — solo servidor. Dentro de compose apunta a
//      la red interna (http://backend:8000). Ausente en dev host-native.
//   2. NEXT_PUBLIC_API_URL  — lo que resuelve el navegador. Sirve de
//      default para que `pnpm dev` en el host no cambie de comportamiento.
//   3. http://localhost:8000 — ultimo recurso.
export function resolveBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000"
  );
}
```

and calls it inside `fetchProfileStatus`:

```ts
const response = await fetch(`${resolveBackendUrl()}/api/profile/status`, {
```

Three `process.env` reads per protected-route navigation is not a measurable cost against a
3-second-timeout network fetch on the same line. What it buys: direct unit tests via
`vi.stubEnv`, and a value that a runtime `environment:` entry can actually influence.

**Write the member expressions in full (`process.env.BACKEND_INTERNAL_URL`), never
destructured.** Bundlers perform static replacement on that exact syntax;
`const { BACKEND_INTERNAL_URL } = process.env` defeats it.

### 7.3 The Edge-runtime hazard — why `BACKEND_INTERNAL_URL` is *also* a build ARG

`proxy.ts` has no `runtime` export, so it runs on Next's default middleware runtime (Edge).
Environment access in that runtime is **statically inlined at build time**, not read from
the process at request time. If that holds in Next 16, a purely-runtime
`BACKEND_INTERNAL_URL` in compose would be invisible to `profile-status.ts` and the
onboarding gate would fail open — the precise defect this change exists to remove, arriving
by a different door.

Rather than bet on which behaviour Next 16 has, §3 and §5 supply `BACKEND_INTERNAL_URL`
through **both** channels: a build `ARG`+`ENV` in the builder stage *and* a runtime
`environment:` entry. Whichever the runtime consults, it finds the same correct value. The
cost is one extra `ARG` line; the compose-level default `${BACKEND_INTERNAL_URL:-http://backend:8000}`
means it never becomes a fourth mandatory entry in the root `.env`.

**Apply-time check (do not skip):** after the first successful `docker compose up`, confirm
the onboarding redirect actually fires (exit criterion 4). If it does not, the diagnosis
order is (a) is `BACKEND_INTERNAL_URL` present in the running container's env, (b) is it
present in the built bundle, (c) does adding `export const runtime = "nodejs"` to `proxy.ts`
fix it. Option (c) is a scope expansion and should be reported, not applied silently.

### 7.4 Host-native dev is unchanged

With no `BACKEND_INTERNAL_URL` set, `resolveBackendUrl()` returns `NEXT_PUBLIC_API_URL` —
byte-identical to today's behaviour. That is exit criterion 9 and it is a deliberate
property of the fallback order, not a happy accident.

---

## 8. Root `.env.example` — and the `.gitignore` trap

```bash
# Variables que Compose necesita interpolar EN TIEMPO DE BUILD.
#
# Solo estas tres viven aca. `next build` las inlinea en el bundle del
# cliente y Compose no puede alimentar `build.args` desde un env_file,
# asi que se duplican desde frontend/.env.local. Es duplicacion aceptada
# y documentada (proposal, Decisions 5).
#
# Las variables reales de cada servicio siguen viviendo en:
#   backend/.env         -> lo consume el servicio backend via env_file
#   frontend/.env.local  -> lo consume `pnpm dev` host-native
#
# OJO: frontend/.env.local NO entra a la imagen (lo excluye .dockerignore,
# a proposito). Si estos valores estan vacios aca, la imagen compila verde
# y el navegador recibe strings vacios: el login falla sin error de build.

NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...

# Lo resuelve el NAVEGADOR. Debe ser localhost, no el nombre del servicio.
NEXT_PUBLIC_API_URL=http://localhost:8000

# Opcional. Lo resuelve el SERVIDOR de Next dentro de compose. Si se omite,
# docker-compose.yml ya usa http://backend:8000 por defecto.
# BACKEND_INTERNAL_URL=http://backend:8000
```

**The trap:** root `.gitignore:3` is `.env.*`, which matches `.env.example`. Committing the
file requires a negation, added immediately after the existing env block:

```gitignore
.env.staging
# .env.example SI se versiona: documenta los build args de docker compose
# y no contiene secretos.
!.env.example
```

Without this line the file is written, never staged, and the next clone has no template —
a failure that looks like "someone forgot to commit it".

`backend/.gitignore` has the same `.env.*` pattern but no `.env.example` is added there, so
it needs no change.

---

## 9. `backend/app/config.py` — remove `supabase_jwt_secret`

Grep performed during design across the whole repository for
`supabase_jwt_secret|SUPABASE_JWT_SECRET|jwt_secret`:

| Location | Kind |
|---|---|
| `backend/app/config.py:20` | the declaration itself |
| `docker-compose.yml:17` | the compose wiring being deleted |
| `CLAUDE.md:173`, `CONTENTSPARK_SAAS_PROJECT.md:350`, `CONTENTSPARK_SAAS_ROADMAP.md:128`, `.agents/skills/**` | prose saying it is obsolete |
| `openspec/changes/docker-deploy-setup/proposal.md` | this change's own text |

**No live reader exists.** The proposal's conditional ("if a grep at apply time finds a live
reader, the field stays") resolves to: delete the field. One line removed from `Settings`,
one line removed from compose. Re-run the grep at apply time to confirm nothing landed in
between; the result must be the same table minus the compose row.

`Settings.Config.env_file = ".env"` stays. That file is excluded from the image by
`.dockerignore`, and `pydantic-settings` treats a missing `env_file` as a no-op, falling
through to real environment variables — which is exactly what `env_file:` in compose
provides. No change needed, but do not "fix" the missing file by un-ignoring it.

---

## 10. Verification design

`openspec/config.yaml` sets `strict_tdd: true`, and almost nothing here is unit-testable.
Being honest about that split is part of the design.

### 10.1 What gets real tests (TDD applies)

`frontend/shared/lib/profile-status.test.ts` — three new tests, RED before the §7 change:

| Test | Setup | Assert |
|---|---|---|
| `resolveBackendUrl` prefers `BACKEND_INTERNAL_URL` | `vi.stubEnv("BACKEND_INTERNAL_URL", "http://backend:8000")` + `vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000")` | `=== "http://backend:8000"` |
| falls back to `NEXT_PUBLIC_API_URL` | only `NEXT_PUBLIC_API_URL` stubbed | `=== "http://localhost:8000"` (the stubbed value, distinct from the literal default — use a third value like `http://api.test:9000` so the two branches are distinguishable) |
| falls back to the hardcoded default | both unset (`vi.stubEnv(..., undefined)`) | `=== "http://localhost:8000"` |

Add `vi.unstubAllEnvs()` to the existing `afterEach` (currently `restoreAllMocks` +
`unstubAllGlobals`, lines 4-7). Forgetting it leaks env state into the five existing
fail-open tests.

The five existing `fetchProfileStatus` tests must stay green untouched — they stub `fetch`
and never assert on the URL, so the refactor is invisible to them. That is the regression
proof for §7.

TDD order: write the three tests (RED — `resolveBackendUrl` is not exported yet, so the file
fails to collect), then make the §7 change (GREEN), then everything else.

### 10.2 What gets behavioural verification (no unit tests, and that is correct)

Dockerfiles and compose YAML have no unit-test surface. Their verification is the proposal's
exit criteria, executed. The ordering that matters:

1. `docker compose build` — proves the alpine decision of §3.3 one way or the other. This is
   the first gate and the one most likely to need the fallback.
2. `docker compose up` + `curl http://localhost:8000/` → `{"status":"ok",...}`.
3. **Browser login round-trip at `http://localhost:3000`.** Non-negotiable: this is the only
   check that distinguishes a correct bundle from an empty-`NEXT_PUBLIC_*` bundle, and both
   build green.
4. **Observed onboarding redirect** (not absence-of-error) — see §7.3.
5. Dev overlay hot reload for both services.
6. Layer inspection: no `.env`, `.env.local`, host `node_modules`, or `.git` in either image.
7. `rg -n 'postgres|SUPABASE_JWT_SECRET' docker-compose*.yml` → empty;
   `rg -n 'npm run' docker-compose*.yml` → empty.
8. Host-native unregressed: `mamba run -n contentspark pytest backend/tests` and
   `pnpm --dir frontend test` pass; `pnpm --dir frontend dev` still hits `localhost:8000`
   with no `BACKEND_INTERNAL_URL` set.

`sdd-tasks` should encode step 3 and step 4 as explicit manual checks with a recorded
observation, not as "build succeeded".

---

## 11. ADR-style decision record

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| D1 | Server-only `BACKEND_INTERNAL_URL`, precedence `BACKEND_INTERNAL_URL → NEXT_PUBLIC_API_URL → http://localhost:8000` | One variable cannot serve two network namespaces; the fallback makes host-native dev a byte-identical no-op | Leave it and accept a silently no-op onboarding redirect inside Docker; publish the backend and reach it through the host (fragile, platform-dependent) |
| D2 | Three `NEXT_PUBLIC_*` duplicated into a committed root `.env.example` | Compose cannot source `build.args` from `env_file`, and `next build` inlines them; three variables is the minimum viable duplication | Move all env files to the repo root (breaks every host-native script and workflow) |
| D3 | Remove `supabase_jwt_secret` from compose **and** `Settings` | Repo-wide grep found zero live readers; leaving the field invites a future "fix" that rewires the dead compose variable | Clean compose only, keeping the change strictly infrastructural |
| D4 | No container runs Alembic; documented as a comment in `docker-compose.yml` | Every replica racing to migrate a shared Supabase database is a worse default than the deliberate host command `CLAUDE.md` already prescribes | A one-shot `migrate` compose profile (still an in-container migration path, invoked by habit) |
| D5 | Dev images single-stage, root, no healthcheck | They exist for iteration; root avoids bind-mount permission failures writing `__pycache__`/`.next` | Mirror the production image (permission pain, longer builds, zero benefit); drop the dev path entirely |
| D6 | Backend: 2 stages with a `/opt/venv` transfer unit | A venv is a single self-contained directory that `COPY --from` moves atomically, and survives a runtime user differing from the build user | `pip install --user` (breaks on user change); single stage (ships pip caches and build tooling) |
| D7 | Healthcheck via `python -c urllib.request`, not `curl` | `python:3.11-slim` has no curl; installing one purely for a healthcheck is a layer for nothing | `apt-get install curl`; no healthcheck at all (loses the `service_healthy` gate of D12) |
| D8 | Frontend: 3 stages (deps/builder/runner) | `deps` keeps source edits from re-running `pnpm install`; `runner` keeps `node_modules`, source, and build ARGs out of the shipped layer | 2 stages (either loses install caching or ships the build tree) |
| D9 | `node:20-alpine` first, `node:20-slim` as a *verified* fallback with a 4-line swap | The musl `sharp`/`unrs-resolver` risk is real but unproven; assuming it upfront pays Debian's size for nothing. The file is structured so the swap is mechanical | Start on `node:20-slim` (assumes the failure); pin per-package musl workarounds (fragile, package-specific) |
| D10 | `BACKEND_INTERNAL_URL` supplied as build ARG **and** runtime env | Edge-runtime middleware inlines env at build time; supplying both makes the value correct regardless of which channel Next 16 actually consults | Runtime-only (risks a silently fail-open proxy); force `runtime = "nodejs"` on `proxy.ts` (scope expansion, changes proxy execution semantics) |
| D11 | `resolveBackendUrl()` function instead of a module-level `const` | Makes the precedence rule directly unit-testable without `resetModules`, and lets a runtime env actually influence the value | Keep the module const (untestable precedence, frozen at import) |
| D12 | `depends_on: condition: service_healthy` for frontend → backend | `fetchProfileStatus` fails open, so a backend that is not yet up produces a wrong-but-silent redirect decision rather than an error | Bare `depends_on` / `service_started` (container running ≠ FastAPI ready) |
| D13 | `env_file: ./backend/.env` instead of nine `${VAR}` lines | The file already exists and is already the contract; zero duplication, and Compose fails loudly when it is missing | Enumerate every backend variable in compose (drifts the moment a variable is added) |
| D14 | `backend/data/` excluded from the image, bind-mounted `:ro` | The corpus is an input to the `ingest_data.py` CLI, not to the API process; no router or service reads it | Copy it into the image (tens of MB of dead weight in every layer and every future push) |
| D15 | `!.env.example` negation added to root `.gitignore` | Existing `.env.*` pattern silently swallows the new template; without the negation the file is written and never committed | Rename the file (breaks the universal `.env.example` convention); loosen the `.env.*` pattern (weakens the secret guard) |

---

## 12. Delivery shape

Single PR, single slice. The proposal estimates ~270 changed lines against a 400 budget,
with room for the alpine→slim fallback. There is no useful intermediate state to split at:
a PR with Dockerfiles but the old compose file does not come up, and a PR with the new
compose file but no Dockerfiles is the exact broken state this change repairs.

Suggested apply order (each step leaves the tree no worse than it found it):

1. `profile-status.ts` tests (RED) → `resolveBackendUrl` (GREEN). Independently correct and
   independently revertible; nothing else depends on Docker existing.
2. `next.config.ts` `output: "standalone"` + `.dockerignore` × 2 + root `.env.example` +
   `.gitignore` negation. All inert until a build runs.
3. `backend/Dockerfile` + `Dockerfile.dev`; `docker compose build backend` must pass here.
4. `frontend/Dockerfile` + `Dockerfile.dev`; **this is where §3.3 is decided.**
5. Compose rewrite (both files) + `config.py` cleanup.
6. Behavioural verification (§10.2), including the browser round-trip.

Step 4 is the risky one and it is deliberately late, so that a base-image fallback does not
invalidate work already verified.

---

## 13. Open items handed to later phases

- **Which base image actually shipped** (§3.3) is not decidable at design time. `sdd-apply`
  records it; if `node:20-slim` was needed, the error signature belongs in the change record
  because it will recur on the GCP image.
- **Whether the Edge runtime inlines `BACKEND_INTERNAL_URL`** (§7.3) is verified by exit
  criterion 4, not by inspection. If option (c) — `runtime = "nodejs"` on `proxy.ts` — turns
  out to be required, that is a scope expansion to report, not to apply silently.
- **The `docker-compose.dev.yml` volume merge** for `./backend/data:/app/data:ro` under
  `./backend:/app` (§6) is expected to work and must be observed, not assumed.
- **Cloud Run constraints are explicitly not addressed.** `--host 0.0.0.0` /
  `HOSTNAME=0.0.0.0` and the `$PORT` question, secret mounting, and the fact that Cloud Run
  ignores `HEALTHCHECK` are all the next change's problem. Nothing here forecloses them.
- **No delta specs.** Per the proposal's "Affected capabilities" section, this change adds
  no user-facing behaviour. `sdd-spec` confirms rather than manufactures a capability; if it
  concludes the `BACKEND_INTERNAL_URL` precedence deserves a requirement, the home is the
  capability owning the onboarding redirect, not a new one.
