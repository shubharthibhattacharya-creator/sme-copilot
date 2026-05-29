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

# Railway Runtime V2 does not inject service variables at container runtime.
# Workaround: declare ARGs so Railway passes them during build, then promote
# to ENV so they are baked into the image and available at startup.
ARG DATABASE_URL
ARG CLERK_SECRET_KEY
ARG CLERK_WEBHOOK_SECRET
ARG ANTHROPIC_API_KEY
ARG ANTHROPIC_MODEL=claude-sonnet-4-6
ARG ENCRYPTION_KEY
ARG API_PORT=3001
ARG API_URL
ARG ADMIN_SECRET
ARG NEXT_PUBLIC_APP_URL
ENV DATABASE_URL=$DATABASE_URL
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV CLERK_WEBHOOK_SECRET=$CLERK_WEBHOOK_SECRET
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV ANTHROPIC_MODEL=$ANTHROPIC_MODEL
ENV ENCRYPTION_KEY=$ENCRYPTION_KEY
ENV API_PORT=$API_PORT
ENV API_URL=$API_URL
ENV ADMIN_SECRET=$ADMIN_SECRET
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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

# Run DB migration then start server
# prisma db push is used (no migration files in repo yet)
# Switch to `migrate deploy` once migration files are committed
CMD ["node", "apps/api/dist/main.js"]
