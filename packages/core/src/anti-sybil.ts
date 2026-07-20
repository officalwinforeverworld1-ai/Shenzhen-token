/**
 * Shén Zhèn Airdrop — Anti-Sybil Engine
 *
 * "Meaningfully raises the cost of cheap abuse" — not bulletproof, by design.
 * Real filtering happens at token-claim time using wallet-based signals (future phase).
 *
 * Current detections:
 * 1. Rapid referral clustering — too many referrals in a short window
 * 2. New account burst — suspicious point accumulation right after signup
 * 3. Similar names — referral chains with suspiciously similar usernames
 *
 * All detections write to `sybilFlags` for human review. No auto-bans.
 */

import { prisma, Prisma } from "@shen-zhen/database";
import type { SybilFlag } from "@shen-zhen/database";
import {
  SYBIL_RAPID_REFERRAL_THRESHOLD,
  SYBIL_NEW_ACCOUNT_BURST_THRESHOLD,
} from "@shen-zhen/shared";

/**
 * Run all sybil checks for a user after referral qualification.
 * Called as a background job — NOT in the hot path.
 */
export async function checkAndFlagSuspicious(userId: number): Promise<void> {
  await Promise.allSettled([
    checkRapidReferrals(userId),
    checkNewAccountBurst(userId),
    checkSimilarNames(userId),
  ]);
}

/**
 * Flag if a user received too many referrals in a short window.
 * Indicates possible fake-invite farming with bot accounts.
 */
async function checkRapidReferrals(userId: number): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentReferrals = await prisma.referral.count({
    where: {
      referrerId: userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentReferrals >= SYBIL_RAPID_REFERRAL_THRESHOLD) {
    await createFlag(userId, "rapid_referrals", "high", {
      referralsInLastHour: recentReferrals,
      threshold: SYBIL_RAPID_REFERRAL_THRESHOLD,
    });
  }
}

/**
 * Flag if a new account accumulates suspicious points in first hour.
 */
async function checkNewAccountBurst(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Only check accounts less than 2 hours old
  const accountAge = Date.now() - user.createdAt.getTime();
  if (accountAge > 2 * 60 * 60 * 1000) return;

  const result = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });

  const totalPoints = result._sum.amount ?? 0;

  if (totalPoints >= SYBIL_NEW_ACCOUNT_BURST_THRESHOLD) {
    await createFlag(userId, "new_account_burst", "medium", {
      pointsEarned: totalPoints,
      accountAgeMinutes: Math.floor(accountAge / 60_000),
      threshold: SYBIL_NEW_ACCOUNT_BURST_THRESHOLD,
    });
  }
}

/**
 * Flag referral chains where referred users have suspiciously similar usernames.
 * E.g., "user_abc_1", "user_abc_2", "user_abc_3" all referred by same person.
 */
async function checkSimilarNames(userId: number): Promise<void> {
  // Get the user's referrals with their usernames
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: {
      referee: {
        select: { username: true, firstName: true },
      },
    },
    take: 20,
  });

  if (referrals.length < 3) return; // need at least 3 to detect a pattern

  // Simple heuristic: check for common prefix in usernames
  const usernames = referrals
    .map((r) => r.referee.username?.toLowerCase())
    .filter((u): u is string => u !== null && u !== undefined);

  if (usernames.length < 3) return;

  // Find longest common prefix among any 3+ usernames
  const prefixCounts = new Map<string, number>();
  for (const name of usernames) {
    // Check prefixes of length 4+
    for (let len = 4; len <= Math.min(name.length, 15); len++) {
      const prefix = name.slice(0, len);
      prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
    }
  }

  for (const [prefix, count] of prefixCounts) {
    if (count >= 3 && prefix.length >= 4) {
      await createFlag(userId, "similar_names", "medium", {
        commonPrefix: prefix,
        matchCount: count,
        sampleUsernames: usernames.slice(0, 5),
      });
      break; // one flag per check is enough
    }
  }
}

/**
 * Create a sybil flag (idempotent — won't duplicate for same type + recent window).
 */
async function createFlag(
  userId: number,
  flagType: string,
  severity: string,
  details: Record<string, unknown>,
): Promise<void> {
  // Don't create duplicate flags within 24 hours
  const recentFlag = await prisma.sybilFlag.findFirst({
    where: {
      userId,
      flagType,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  if (recentFlag) return; // already flagged recently

  await prisma.sybilFlag.create({
    data: {
      userId,
      flagType,
      severity,
      details: details as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get unresolved sybil flags for admin review.
 */
export async function getUnresolvedFlags(
  limit: number = 20,
  offset: number = 0,
): Promise<{ flags: (SybilFlag & { user: { id: number; firstName: string; username: string | null; telegramId: bigint } })[]; total: number }> {
  const [flags, total] = await Promise.all([
    prisma.sybilFlag.findMany({
      where: { isResolved: false },
      include: {
        user: {
          select: { id: true, firstName: true, username: true, telegramId: true },
        },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.sybilFlag.count({ where: { isResolved: false } }),
  ]);

  return { flags: flags as typeof flags, total };
}

/**
 * Resolve a sybil flag (admin action).
 */
export async function resolveFlag(
  flagId: number,
  adminUserId: number,
  resolution: "dismissed" | "banned" | "cleared",
): Promise<void> {
  await prisma.sybilFlag.update({
    where: { id: flagId },
    data: {
      isResolved: true,
      resolvedBy: adminUserId,
      resolution,
      resolvedAt: new Date(),
    },
  });

  // If banned, ban the user
  if (resolution === "banned") {
    const flag = await prisma.sybilFlag.findUnique({ where: { id: flagId } });
    if (flag) {
      await prisma.user.update({
        where: { id: flag.userId },
        data: { isBanned: true },
      });
    }
  }
}
