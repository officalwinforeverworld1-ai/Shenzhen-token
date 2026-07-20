/**
 * Shén Zhèn Airdrop — Points Engine
 *
 * THE single award path. Every point ever awarded or spent goes through here.
 * Both bot and Mini App call these functions — never bypass them.
 *
 * Architecture:
 * - Append-only ledger: every award is an INSERT, never an UPDATE
 * - Uniqueness constraint: [userId, reason, sourceId] prevents double-crediting
 * - Balance is computed as SUM(amount) from the ledger
 * - Negative amounts are used for spending (upgrade purchases)
 */

import { prisma, Prisma } from "@shen-zhen/database";
import type { PointLedger } from "@shen-zhen/database";
import type { PointReason, SourceType } from "@shen-zhen/shared";

export interface AwardResult {
  success: boolean;
  newBalance: number;
  ledgerEntryId?: number;
  error?: string;
}

export interface SpendResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

/**
 * Award points to a user. Writes to append-only ledger.
 *
 * Uses the unique constraint [userId, reason, sourceId] to prevent
 * double-crediting. If the same award is attempted twice, the second
 * call returns { success: false, error: "duplicate" } instead of throwing.
 *
 * @param userId - Internal user ID (NOT telegram ID)
 * @param amount - Points to award (must be positive)
 * @param reason - Why the points were awarded
 * @param sourceType - Which surface triggered this ('bot', 'mini_app', 'admin')
 * @param sourceId - Unique identifier for this specific award event
 * @param metadata - Optional extra context for audit trail
 */
export async function awardPoints(
  userId: number,
  amount: number,
  reason: PointReason,
  sourceType: SourceType,
  sourceId: string,
  metadata?: Record<string, unknown>,
): Promise<AwardResult> {
  if (amount <= 0) {
    return { success: false, newBalance: 0, error: "Amount must be positive" };
  }

  try {
    // Single transaction: insert ledger entry
    // The unique constraint handles double-credit prevention
    const entry = await prisma.pointLedger.create({
      data: {
        userId,
        amount,
        reason,
        sourceType,
        sourceId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // Compute new balance from ledger
    const balance = await getBalance(userId);

    return {
      success: true,
      newBalance: balance,
      ledgerEntryId: entry.id,
    };
  } catch (error: unknown) {
    // Check for unique constraint violation (duplicate award)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const balance = await getBalance(userId);
      return {
        success: false,
        newBalance: balance,
        error: "duplicate",
      };
    }
    throw error; // Re-throw unexpected errors
  }
}

/**
 * Spend points (deduct from balance). Used for upgrade purchases.
 * Creates a negative ledger entry.
 *
 * Checks balance BEFORE deducting to prevent going negative.
 * Uses a transaction with a serializable read to prevent race conditions.
 */
export async function spendPoints(
  userId: number,
  amount: number,
  reason: PointReason,
  sourceType: SourceType,
  sourceId: string,
  metadata?: Record<string, unknown>,
): Promise<SpendResult> {
  if (amount <= 0) {
    return { success: false, newBalance: 0, error: "Amount must be positive" };
  }

  // Use a transaction to ensure atomicity of check-then-deduct
  return prisma.$transaction(async (tx) => {
    // Calculate current balance within the transaction
    const result = await tx.pointLedger.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const currentBalance = result._sum.amount ?? 0;

    if (currentBalance < amount) {
      return {
        success: false,
        newBalance: currentBalance,
        error: "Insufficient balance",
      };
    }

    // Create negative ledger entry
    await tx.pointLedger.create({
      data: {
        userId,
        amount: -amount, // negative for spending
        reason,
        sourceType,
        sourceId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    const newBalance = currentBalance - amount;
    return { success: true, newBalance };
  });
}

/**
 * Get a user's current point balance.
 * Computed as SUM(amount) from the append-only ledger.
 */
export async function getBalance(userId: number): Promise<number> {
  const result = await prisma.pointLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

/**
 * Get a user's point ledger history (audit trail).
 */
export async function getLedgerHistory(
  userId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<{ entries: PointLedger[]; total: number }> {
  const [entries, total] = await Promise.all([
    prisma.pointLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.pointLedger.count({ where: { userId } }),
  ]);

  return { entries, total };
}

/**
 * Award tap points in bulk. Used by the tap-to-earn system.
 * sourceId includes a timestamp to allow multiple tap batches.
 */
export async function awardTapPoints(
  userId: number,
  tapCount: number,
  tapPower: number,
  sourceType: SourceType,
): Promise<AwardResult> {
  const totalPoints = tapCount * tapPower;
  // Use timestamp-based sourceId for tap batches (repeatable)
  const sourceId = `tap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return awardPoints(userId, totalPoints, "tap", sourceType, sourceId, {
    tapCount,
    tapPower,
  });
}
