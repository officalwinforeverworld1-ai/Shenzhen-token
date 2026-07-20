/**
 * Shén Zhèn Airdrop — Bot + API Server Entry Point
 *
 * Architecture:
 * - Fastify server serves both the Telegram webhook AND the Mini App API
 * - grammY bot handles webhook updates
 * - p-queue processes heavy work in the background
 * - Same process, same database connection, one deployment unit
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import staticServe from "@fastify/static";
import { Bot, webhookCallback } from "grammy";
import { setupBot } from "./bot/index.js";
import { registerApiRoutes } from "./api/routes/index.js";
import { cleanupTapRateLimiter } from "@shen-zhen/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Environment Validation ────────────────────────────
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

// Auto-detect webhook URL: explicit WEBHOOK_URL > Railway auto-domain > undefined (polling)
const RAILWAY_DOMAIN = process.env["RAILWAY_PUBLIC_DOMAIN"];
const WEBHOOK_URL = process.env["WEBHOOK_URL"]
  ?? (RAILWAY_DOMAIN ? `https://${RAILWAY_DOMAIN}` : undefined);

const MINI_APP_URL = process.env["MINI_APP_URL"] ?? `http://localhost:${PORT}/app`;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

// ─── Initialize Bot ────────────────────────────────────
const bot = new Bot(BOT_TOKEN);
setupBot(bot);

// ─── Initialize Fastify ────────────────────────────────
const app = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
  },
});

// CORS for Mini App requests
await app.register(cors, {
  origin: true,
  credentials: true,
});

// Rate limiting — global: 100 req/min per IP
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => {
    // Use X-Forwarded-For behind proxy, otherwise remote IP
    return (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? request.ip;
  },
  errorResponseBuilder: (_request, context) => ({
    success: false,
    error: `Rate limit exceeded. Try again in ${Math.ceil((context.ttl ?? 60000) / 1000)}s`,
  }),
});

// ─── Serve Mini App Static Files ───────────────────────
// Serves the built Vite dist folder at /app/*
const miniAppDist = path.resolve(__dirname, "../../mini-app/dist");
await app.register(staticServe, {
  root: miniAppDist,
  prefix: "/app/",
  // decorateReply must be true (default) for reply.sendFile to work
});

// SPA fallback — any /app/* deep path serves index.html
app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith("/app")) {
    return reply
      .code(200)
      .header("content-type", "text/html; charset=utf-8")
      .send(await import("node:fs").then(fs => fs.promises.readFile(path.join(miniAppDist, "index.html"), "utf8")));
  }
  return reply.code(404).send({ error: "Not found" });
});


// ─── Webhook Route ─────────────────────────────────────
// Minimal synchronous work: validate, pass to grammY, return 200
app.post("/webhook", async (request, reply) => {
  const handleUpdate = webhookCallback(bot, "fastify");
  return handleUpdate(request, reply);
});

// ─── Health Check ──────────────────────────────────────
// Root → Mini App redirect
app.get("/", async (_req, reply) => {
  return reply.redirect("/app/");
});

app.get("/health", async () => {

  return { status: "ok", timestamp: new Date().toISOString() };
});

// ─── Mini App API Routes ───────────────────────────────
registerApiRoutes(app, bot);

// ─── Periodic Cleanup ──────────────────────────────────
// Clean up in-memory rate limiter every 60 seconds
setInterval(() => {
  cleanupTapRateLimiter();
}, 60_000);

// ─── Start Server ──────────────────────────────────────
async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`\n🚀 Server running on port ${PORT}`);

    // Set webhook OR start polling
    if (WEBHOOK_URL) {
      try {
        await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`, {
          drop_pending_updates: true,
        });
        console.log(`📡 Webhook set to ${WEBHOOK_URL}/webhook`);
      } catch (webhookErr) {
        console.error(`⚠️ Webhook setup failed, falling back to polling:`, webhookErr);
        await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
        bot.start({
          onStart: () => console.log("🟢 Bot polling started (webhook fallback)"),
        });
      }
    } else {
      // Local dev mode — use long polling instead of webhook
      console.log("🔄 No WEBHOOK_URL — starting in polling mode (local dev)");
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      bot.start({
        onStart: () => console.log("🟢 Bot polling started"),
      });
    }

    // Get bot info
    const me = await bot.api.getMe();
    console.log(`🤖 Bot: @${me.username} (${me.first_name})`);
    console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);
    console.log();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

// ─── Graceful Shutdown ─────────────────────────────────
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await app.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down...");
  await app.close();
  process.exit(0);
});

// Export for use in other modules
export { bot, app };
