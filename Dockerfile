# ──────────────────────────────────────────────────
# Shén Zhèn Airdrop — Production Dockerfile
# Multi-stage build: builds all packages, then runs
# the bot server which also serves the mini-app static files.
# ──────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package files first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/
COPY apps/mini-app/package.json apps/mini-app/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/bot/ apps/bot/
COPY apps/mini-app/ apps/mini-app/

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build shared packages first, then apps
RUN pnpm --filter @shen-zhen/shared build 2>/dev/null || true
RUN pnpm --filter @shen-zhen/core build 2>/dev/null || true
RUN pnpm --filter @shen-zhen/mini-app build
RUN pnpm --filter @shen-zhen/bot build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy package manifests + lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema + generated client
COPY packages/database/prisma/ packages/database/prisma/
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/ node_modules/@prisma/client/

# Copy built code
COPY --from=builder /app/packages/core/dist/ packages/core/dist/
COPY --from=builder /app/packages/core/package.json packages/core/package.json
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/database/dist/ packages/database/dist/
COPY --from=builder /app/packages/database/package.json packages/database/package.json
COPY --from=builder /app/apps/bot/dist/ apps/bot/dist/
COPY --from=builder /app/apps/bot/package.json apps/bot/package.json

# Copy mini-app static build
COPY --from=builder /app/apps/mini-app/dist/ apps/mini-app/dist/

# Environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Run the server
CMD ["node", "apps/bot/dist/index.js"]
