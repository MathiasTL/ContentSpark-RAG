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
