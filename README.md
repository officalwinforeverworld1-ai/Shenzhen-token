<div align="center">

# ⚡ Shén Zhèn Airdrop ($SHEN)

**Production-Grade Telegram Tap-to-Earn & Web3 DApp Ecosystem**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4.0-000000?style=for-the-badge&logo=fastify)](https://www.fastify.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![TON](https://img.shields.io/badge/TON_Connect-3.0-0088CC?style=for-the-badge&logo=telegram)](https://ton.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=for-the-badge&logo=turborepo)](https://turbo.build/)

</div>

---

## 🌟 Overview

**Shén Zhèn Airdrop** is a full-stack, enterprise-grade Telegram Mini App ecosystem designed for viral token distribution and Web3 user onboarding. Built on a modern TypeScript monorepo architecture, it seamlessly connects Telegram bot interactions with a high-performance, dark-mode Web3 frontend and a real-time administrative control dashboard.

---

## ✨ Features

### 🎮 Tap-to-Earn Core Engine
- **Interactive Coin Clicker**: High-performance multi-touch support with dynamic float particles (+1 floating text).
- **Energy Regeneration System**: Configurable capacity and per-second recovery rates.
- **Boost & Upgrade Shop**: Spend earned `$SHEN` to upgrade Tap Power, Max Energy capacity, and Energy Regen speed.

### 🎰 Games & Rewards Hub
- **Spin Wheel**: 8-slice prize wheel with free daily spins and paid spin options (win up to 5,000 $SHEN!).
- **Daily Check-in**: Streak multiplier system rewarding consecutive daily engagement up to 500 $SHEN/day.
- **Mystery Box & Challenges**: Modular placeholder infrastructure ready for Phase 2 expansion.

### 🪙 Native Web3 & TON Wallet Integration
- **TON Connect 3.0 Integration**: Direct wallet linking with Tonkeeper and Telegram `@wallet`.
- **Automatic Sync**: Real-time address validation and database synchronization (`walletAddress`, `walletConnectedAt`).

### 🛡️ Security & Anti-Sybil Defense
- **Per-Route Rate Limiting**: Built-in `@fastify/rate-limit` protecting against bot farms (`/api/auth`: 10/min, `/api/tap`: 120/min).
- **HMAC Verification**: Cryptographic validation of Telegram `initData` payloads.
- **JWT Session Management**: Secure 24h token authentication for API routes.

### 📊 Admin Management Portal
- **Dashboard**: Real-time analytics, user monitoring, and referral metrics.
- **Broadcast System**: Push bulk announcements and interactive messages to all registered bot users.
- **User Moderation**: 1-click ban/unban controls for anti-sybil enforcement.

---

## 🏗️ Monorepo Architecture

```
shenzhen-token/
├── apps/
│   ├── bot/          # Fastify API Server + grammY Telegram Bot
│   ├── mini-app/     # Vite + React Premium Glassmorphism Mini App
│   └── admin/        # Next.js 14 Management Dashboard
├── packages/
│   ├── core/         # Business logic (Energy, Taps, Points, Rewards, Anti-Sybil)
│   ├── database/     # Prisma ORM + PostgreSQL Schema & Migrations
│   └── shared/       # Cross-package Types, Constants & Zod Validators
├── Dockerfile        # Multi-stage production container build
├── railway.toml      # Railway deployment configuration
└── turbo.json        # Turborepo task pipeline
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, `@tonconnect/ui-react`, Vanilla Glassmorphism CSS
- **Backend API**: Fastify, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/static`
- **Telegram Bot**: grammY framework (Webhook & Polling support)
- **Database**: PostgreSQL with Prisma ORM
- **Admin Dashboard**: Next.js 14 (App Router), Tailwind CSS
- **Infrastructure**: Turborepo, pnpm workspaces, Docker, Railway

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v20+`
- **pnpm**: `v9+`
- **PostgreSQL**: Running locally or via Docker

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/i-am-paradox/Shenzhen-token.git
cd Shenzhen-token

# Install dependencies
pnpm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/shen_zhen_airdrop?schema=public"
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
JWT_SECRET="your_random_jwt_secret"
PORT=3000
```

### 4. Database Setup & Seed
```bash
# Push Prisma schema to database
pnpm --filter @shen-zhen/database db:push

# Generate Prisma Client
pnpm --filter @shen-zhen/database generate
```

### 5. Run Development Servers
```bash
# Start all applications in parallel
pnpm dev
```

---

## 🚢 Production Deployment

### Deploy on Railway (Recommended)

1. Fork or push this repository to GitHub.
2. Connect your repository to [Railway](https://railway.app).
3. Add a **PostgreSQL** database plugin.
4. Set the following environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `JWT_SECRET`
   - `WEBHOOK_URL` (`https://<your-railway-domain>`)
   - `MINI_APP_URL` (`https://<your-railway-domain>`)
5. Railway will automatically build the container using the root `Dockerfile` and execute health checks on `/health`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
Built with ❤️ for the Web3 & Telegram Ecosystem
</div>
