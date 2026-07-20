# ──────────────────────────────────────────────────
# Shén Zhèn Airdrop — Production Dockerfile
# Builds bot + mini-app only (admin is separate).
# ──────────────────────────────────────────────────

FROM node:20-alpine AS builder

# Install build tools for native deps (bcryptjs etc)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy only the packages we need (NOT admin)
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/bot/package.json apps/bot/
COPY apps/mini-app/package.json apps/mini-app/

# Install deps (--no-frozen-lockfile because admin is excluded)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/bot/ apps/bot/
COPY apps/mini-app/ apps/mini-app/

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build everything in order
RUN pnpm --filter @shen-zhen/shared build 2>/dev/null || true
RUN pnpm --filter @shen-zhen/core build 2>/dev/null || true
RUN pnpm --filter @shen-zhen/mini-app build
RUN pnpm --filter @shen-zhen/bot build

# ─── Production Stage ───────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy the entire built workspace (simpler & reliable)
COPY --from=builder /app /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/bot/dist/index.js"]
