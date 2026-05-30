# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/config/package.json     packages/config/
COPY packages/types/package.json      packages/types/
COPY packages/database/package.json   packages/database/
COPY apps/api/package.json            apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/  packages/
COPY apps/api/  apps/api/

# Generate Prisma client (no DB needed, just schema introspection)
RUN cd packages/database && npx prisma generate

# Build shared packages then the API
RUN pnpm --filter @opsc/config build
RUN pnpm --filter @opsc/types build
RUN pnpm --filter @opsc/database build
RUN pnpm --filter @opsc/api build

# ── Stage 2: Run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

WORKDIR /app
ENV NODE_ENV=production

# Railway injects service variables as env vars at container runtime.
# Only set non-secret defaults here; all secrets come from Railway service variables.
ENV ANTHROPIC_MODEL=claude-sonnet-4-6
ENV API_PORT=3001

# Copy the full workspace (pnpm symlinks require the virtual store)
COPY --from=builder /app/node_modules              ./node_modules
COPY --from=builder /app/pnpm-workspace.yaml       ./pnpm-workspace.yaml
COPY --from=builder /app/package.json              ./package.json

# Shared packages (compiled)
COPY --from=builder /app/packages/config/dist      ./packages/config/dist
COPY --from=builder /app/packages/config/package.json ./packages/config/package.json
COPY --from=builder /app/packages/types/dist       ./packages/types/dist
COPY --from=builder /app/packages/types/package.json  ./packages/types/package.json
COPY --from=builder /app/packages/database/dist    ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
# Prisma schema + generated client
COPY --from=builder /app/packages/database/prisma  ./packages/database/prisma
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules

# API compiled output
COPY --from=builder /app/apps/api/dist             ./apps/api/dist
COPY --from=builder /app/apps/api/package.json     ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules     ./apps/api/node_modules

# Run DB schema sync then start server
CMD ["sh", "-c", "cd packages/database && npx prisma db push --skip-generate && cd /app && node apps/api/dist/main.js"]
