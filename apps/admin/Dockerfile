# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/types/package.json      packages/types/
COPY apps/admin/package.json          apps/admin/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/types/  packages/types/
COPY apps/admin/      apps/admin/

# Build shared packages first
RUN pnpm --filter @opsc/types build

# Build admin app (outputs to apps/admin/.next/standalone)
RUN pnpm --filter @opsc/admin build

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone bundle
COPY --from=builder /app/apps/admin/.next/standalone ./
# Static assets
COPY --from=builder /app/apps/admin/.next/static     ./apps/admin/.next/static
# Public folder
COPY --from=builder /app/apps/admin/public           ./apps/admin/public

# Railway injects PORT at runtime
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/admin/server.js"]
