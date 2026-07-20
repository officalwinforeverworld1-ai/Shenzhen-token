/**
 * Shén Zhèn Airdrop — API Routes Registration
 *
 * All Mini App API routes are registered here.
 * Every route requires JWT auth (except /api/auth).
 */

import type { FastifyInstance } from "fastify";
import type { Bot } from "grammy";
import { prisma } from "@shen-zhen/database";
import {
  getBalance,
  getEnergyState,
  processTaps,
  getActiveTasks,
  submitTask,
  getLeaderboard,
  getReferralStats,
  getAvailableUpgrades,
  purchaseUpgrade,
} from "@shen-zhen/core";
import {
  TapRequestSchema,
  TaskSubmissionRequestSchema,
  UpgradePurchaseRequestSchema,
} from "@shen-zhen/shared";
import {
  validateInitData,
  issueToken,
  authMiddleware,
  type AuthUser,
} from "../middleware/auth.js";
import type { FastifyRequest } from "fastify";

type AuthenticatedRequest = FastifyRequest & { authUser: AuthUser };

export function registerApiRoutes(app: FastifyInstance, bot: Bot): void {
  // ─── Auth: Exchange initData for JWT ────────────────
  app.post<{ Body: { initData: string } }>("/api/auth", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { initData } = request.body ?? {};

    if (!initData || typeof initData !== "string") {
      return reply.code(400).send({ success: false, error: "initData required" });
    }

    const userData = validateInitData(initData);
    if (!userData) {
      return reply.code(401).send({ success: false, error: "Invalid initData" });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userData.telegramId) },
    });

    if (!user) {
      // Auto-create user from Mini App (they may have opened via direct link)
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(userData.telegramId),
          username: userData.username ?? null,
          firstName: userData.firstName,
          lastName: userData.lastName ?? null,
          isVerified: true, // Mini App users are implicitly verified
        },
      });
    }

    if (user.isBanned) {
      return reply.code(403).send({ success: false, error: "Account is banned" });
    }

    const token = issueToken(user.id, user.telegramId);
    const balance = await getBalance(user.id);
    const energy = getEnergyState(user);

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          username: user.username,
          firstName: user.firstName,
          balance,
          energy,
          tapPower: user.tapPower,
          isVerified: user.isVerified,
        },
      },
    };
  });

  // ─── Dev Auth: Local testing without Telegram ──────
  // Only available when no WEBHOOK_URL (local dev mode)
  if (!process.env["WEBHOOK_URL"]) {
    app.post("/api/dev-auth", async (_request, _reply) => {
      // Find or create a dev user in the actual database
      const DEV_TELEGRAM_ID = BigInt(999999999);
      let user = await prisma.user.findUnique({
        where: { telegramId: DEV_TELEGRAM_ID },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId: DEV_TELEGRAM_ID,
            username: "dev_tester",
            firstName: "Dev User",
            lastName: null,
            isVerified: true,
          },
        });
        // Give the dev user a welcome bonus
        await prisma.pointLedger.create({
          data: {
            userId: user.id,
            amount: 100,
            reason: "WELCOME_BONUS",
            sourceType: "system",
            sourceId: "dev-auth",
          },
        });
      }

      const token = issueToken(user.id, user.telegramId);
      const balance = await getBalance(user.id);
      const energy = getEnergyState(user);

      return {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            telegramId: user.telegramId.toString(),
            username: user.username,
            firstName: user.firstName,
            balance,
            energy,
            tapPower: user.tapPower,
            energyRegenRate: user.energyRegenRate,
            isVerified: user.isVerified,
            referralCount: 0,
          },
        },
      };
    });
  }

  // ─── All routes below require authentication ───────
  const authOpts = { preHandler: authMiddleware };

  // ─── User Profile ──────────────────────────────────
  app.get("/api/user/me", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    const balance = await getBalance(userId);
    const energy = getEnergyState(user);
    const lb = await getLeaderboard(userId);

    return {
      success: true,
      data: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        username: user.username,
        firstName: user.firstName,
        balance,
        energy,
        tapPower: user.tapPower,
        energyRegenRate: user.energyRegenRate,
        rank: lb.userRank?.rank ?? null,
        isVerified: user.isVerified,
        walletAddress: user.walletAddress ?? null,
      },
    };
  });

  // ─── Wallet Connect (TON) ────────────────────────────
  app.post<{ Body: { walletAddress: string } }>("/api/wallet/connect", authOpts, async (request, reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const { walletAddress } = request.body ?? {};

    if (!walletAddress || typeof walletAddress !== "string") {
      return reply.code(400).send({ success: false, error: "walletAddress required" });
    }

    // Basic TON address validation (raw format is 48 chars hex, user-friendly is 48 chars base64)
    const trimmed = walletAddress.trim();
    if (trimmed.length < 32 || trimmed.length > 128) {
      return reply.code(400).send({ success: false, error: "Invalid wallet address format" });
    }

    // Check if wallet is already connected to another user
    const existing = await prisma.user.findFirst({
      where: { walletAddress: trimmed, id: { not: userId } },
    });

    if (existing) {
      return reply.code(409).send({ success: false, error: "Wallet already linked to another account" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: trimmed, walletConnectedAt: new Date() },
    });

    return { success: true, data: { walletAddress: trimmed } };
  });

  app.post("/api/wallet/disconnect", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;

    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: null, walletConnectedAt: null },
    });

    return { success: true };
  });

  // ─── Tap (Tap-to-Earn) ────────────────────────────
  app.post("/api/tap", { ...authOpts, config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;

    const parseResult = TapRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid request",
      });
    }

    const result = await processTaps(userId, parseResult.data.tapCount, "mini_app");
    return result;
  });

  // ─── Tasks ────────────────────────────────────────
  app.get("/api/tasks", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const tasks = await getActiveTasks(userId);
    return { success: true, data: tasks };
  });

  app.post("/api/tasks/submit", authOpts, async (request, reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;

    const parseResult = TaskSubmissionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid request",
      });
    }

    const { taskId, proof, answer } = parseResult.data;

    // For channel tasks, verify membership via bot API
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return reply.code(404).send({ success: false, error: "Task not found" });
    }

    let channelMembershipVerified = false;
    if (task.type === "auto_channel") {
      const verifyData = task.verifyData as { channelId?: string } | null;
      const channelId = verifyData?.channelId;
      if (channelId) {
        try {
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user) {
            const member = await bot.api.getChatMember(
              channelId,
              Number(user.telegramId),
            );
            channelMembershipVerified = ["member", "administrator", "creator"].includes(
              member.status,
            );
          }
        } catch {
          channelMembershipVerified = false;
        }
      }
    }

    const result = await submitTask(userId, taskId, "mini_app", {
      proof,
      quizAnswer: answer,
      channelMembershipVerified,
    });

    return result;
  });

  // ─── Leaderboard ──────────────────────────────────
  app.get("/api/leaderboard", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const lb = await getLeaderboard(userId);
    return { success: true, data: lb };
  });

  // ─── Referrals ────────────────────────────────────
  app.get("/api/referrals", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const me = await bot.api.getMe();
    const stats = await getReferralStats(userId, me.username ?? "");
    return { success: true, data: stats };
  });

  // ─── Upgrades ─────────────────────────────────────
  app.get("/api/upgrades", authOpts, async (request) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const upgrades = await getAvailableUpgrades(userId);
    return { success: true, data: upgrades };
  });

  app.post("/api/upgrades/purchase", authOpts, async (request, reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;

    const parseResult = UpgradePurchaseRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid request",
      });
    }

    const result = await purchaseUpgrade(userId, parseResult.data.upgradeId);
    return result;
  });

  // ─── Daily Check-in ─────────────────────────────────
  app.post("/api/checkin", { ...authOpts, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, _reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const { dailyCheckin } = await import("@shen-zhen/core");

    const result = await dailyCheckin(userId);
    return {
      success: true,
      data: {
        alreadyCheckedIn: result.alreadyCheckedIn ?? false,
        streak: result.streak,
        pointsAwarded: result.pointsAwarded,
        nextReward: result.nextReward,
      },
    };
  });

  app.get("/api/checkin/status", authOpts, async (request, _reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const { getCheckinStatus } = await import("@shen-zhen/core");

    const status = await getCheckinStatus(userId);
    return { success: true, data: status };
  });

  // ─── Spin Wheel ──────────────────────────────────────
  app.post<{ Body: { type?: string } }>("/api/spin", { ...authOpts, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const { executeSpin } = await import("@shen-zhen/core");

    const type = request.body?.type === "paid" ? "paid" : "free";
    const result = await executeSpin(userId, type);

    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error });
    }

    return {
      success: true,
      data: {
        prizeIndex: result.prizeIndex,
        pointsWon: result.pointsWon,
        label: result.label,
        nextFreeSpinAt: result.nextFreeSpinAt ?? null,
      },
    };
  });

  app.get("/api/spin/status", authOpts, async (request, _reply) => {
    const { userId } = (request as AuthenticatedRequest).authUser;
    const { getSpinStatus } = await import("@shen-zhen/core");

    const status = await getSpinStatus(userId);
    return {
      success: true,
      data: {
        canFreeSpin: status.canFreeSpin,
        nextFreeSpinAt: status.nextFreeSpinAt ?? null,
        totalSpins: status.totalSpins,
        totalWon: status.totalWon,
      },
    };
  });
}
