/**
 * Shén Zhèn Airdrop — Referral Engine
 *
 * Referral qualification is the most critical atomic operation in the system.
 * Two simultaneous requests for the same referral must NOT both succeed.
 *
 * Flow:
 * 1. New user signs up with a referral code → createReferral()
 * 2. Referee completes their first real task → qualifyReferral()
 * 3. qualifyReferral uses atomic UPDATE...WHERE status='pending' → only one succeeds
 * 4. On success, awards points to the referrer through the points engine
 */

import { prisma } from "@shen-zhen/database";
import type { Referral } from "@shen-zhen/database";
import {
  REFERRAL_REWARD_POINTS,
  MAX_REFERRALS_PER_HOUR,
  REFERRAL_DEEP_LINK_PREFIX,
  POINT_REASONS,
  SOURCE_TYPES,
} from "@shen-zhen/shared";
import type { ReferralStats } from "@shen-zhen/shared";
import { awardPoints } from "./points.js";

export interface ReferralCreateResult {
  success: boolean;
  referralId?: number;
  error?: string;
}

export interface QualifyResult {
  success: boolean;
  pointsAwarded?: number;
  error?: string;
}

/**
 * Create a pending referral when a new user signs up with a referral code.
 *
 * @param referrerId - Internal user ID of the person who shared the link
 * @param refereeId - Internal user ID of the new user who joined
 */
export async function createReferral(
  referrerId: number,
  refereeId: number,
): Promise<ReferralCreateResult> {
  // Don't allow self-referral
  if (referrerId === refereeId) {
    return { success: false, error: "Cannot refer yourself" };
  }

  // Rate limit: check referrer's recent referral count
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.referral.count({
    where: {
      referrerId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= MAX_REFERRALS_PER_HOUR) {
    return { success: false, error: "Referral rate limit exceeded" };
  }

  try {
    const referral = await prisma.referral.create({
      data: {
        referrerId,
        refereeId,
        status: "pending",
      },
    });

    return { success: true, referralId: referral.id };
  } catch (error: unknown) {
    // refereeId is unique — each user can only be referred once
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "User already has a referrer" };
    }
    throw error;
  }
}

/**
 * Qualify a referral when the referee completes their first real task.
 *
 * THIS IS THE CRITICAL ATOMIC OPERATION.
 * Uses raw SQL: UPDATE ... WHERE refereeId = ? AND status = 'pending'
 * Then checks affected row count. If 0, another request already qualified it.
 *
 * @param refereeId - Internal user ID of the referee who just completed a task
 */
export async function qualifyReferral(
  refereeId: number,
): Promise<QualifyResult> {
  // Atomic conditional update — the WHERE clause acts as a lock
  // If two requests race, only one will match status = 'pending'
  const updateResult = await prisma.$executeRaw`
    UPDATE "Referral"
    SET status = 'qualified', "qualifiedAt" = NOW()
    WHERE "refereeId" = ${refereeId} AND status = 'pending'
  `;

  // If no rows were affected, either:
  // - The referral doesn't exist (user wasn't referred)
  // - It was already qualified (race condition handled)
  if (updateResult === 0) {
    return { success: false, error: "No pending referral found" };
  }

  // Fetch the referral to get the referrer's ID
  const referral = await prisma.referral.findUnique({
    where: { refereeId },
  });

  if (!referral) {
    return { success: false, error: "Referral not found after update" };
  }

  // Award points to the referrer
  const awardResult = await awardPoints(
    referral.referrerId,
    REFERRAL_REWARD_POINTS,
    POINT_REASONS.REFERRAL_REWARD as "referral_reward",
    SOURCE_TYPES.BOT as "bot",
    `referral_${referral.id}`,
    {
      refereeId,
      referralId: referral.id,
    },
  );

  if (awardResult.success) {
    // Mark as rewarded
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: "rewarded",
        rewardedAt: new Date(),
      },
    });
  }

  return {
    success: true,
    pointsAwarded: awardResult.success ? REFERRAL_REWARD_POINTS : 0,
  };
}

/**
 * Get referral statistics for a user.
 */
export async function getReferralStats(
  userId: number,
  botUsername: string,
): Promise<ReferralStats> {
  const [qualified, pending, total] = await Promise.all([
    prisma.referral.count({
      where: { referrerId: userId, status: { in: ["qualified", "rewarded"] } },
    }),
    prisma.referral.count({
      where: { referrerId: userId, status: "pending" },
    }),
    prisma.referral.count({
      where: { referrerId: userId },
    }),
  ]);

  // Calculate total referral earnings from the ledger
  const earningsResult = await prisma.pointLedger.aggregate({
    where: {
      userId,
      reason: POINT_REASONS.REFERRAL_REWARD,
    },
    _sum: { amount: true },
  });

  const referralLink = `https://t.me/${botUsername}?start=${REFERRAL_DEEP_LINK_PREFIX}${userId}`;

  return {
    referralLink,
    totalReferred: total,
    qualifiedCount: qualified,
    pendingCount: pending,
    totalEarned: earningsResult._sum.amount ?? 0,
  };
}

/**
 * Parse a referral code from a /start deep link parameter.
 * Returns the referrer's user ID, or null if not a valid referral code.
 */
export function parseReferralCode(startParam: string): number | null {
  if (!startParam.startsWith(REFERRAL_DEEP_LINK_PREFIX)) {
    return null;
  }

  const idStr = startParam.slice(REFERRAL_DEEP_LINK_PREFIX.length);
  const id = parseInt(idStr, 10);

  if (isNaN(id) || id <= 0) {
    return null;
  }

  return id;
}

/**
 * Get referral list for a user (their referred users).
 */
export async function getReferralList(
  userId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<{ referrals: Referral[]; total: number }> {
  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.referral.count({ where: { referrerId: userId } }),
  ]);

  return { referrals, total };
}
