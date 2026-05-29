# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/config/package.json     packages/config/
COPY packages/types/package.json      packages/types/
COPY packages/database/package.json   packages/database/
COPY apps/web/package.json            apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/  packages/
COPY apps/web/  apps/web/

# Build shared packages first
RUN pnpm --filter @opsc/config build
RUN pnpm --filter @opsc/types build

# Build Next.js (outputs to apps/web/.next/standalone)
RUN pnpm --filter @opsc/web build

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone bundle
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
# Public folder
COPY --from=builder /app/apps/web/public           ./apps/web/public

# Railway injects PORT; Next.js standalone reads it automatically
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
