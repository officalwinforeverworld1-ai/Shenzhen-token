/**
 * Shén Zhèn Airdrop — Broadcast Engine
 *
 * Queued, rate-limited message broadcasting to all users.
 * NEVER a synchronous loop — always batched with delays.
 *
 * Telegram bot rate limits:
 * - ~30 messages/second for regular bots
 * - We use 25/sec to leave headroom
 *
 * Architecture:
 * 1. Admin creates broadcast → saved to DB with status 'queued'
 * 2. Background worker picks it up, processes in batches
 * 3. Each batch sends N messages, then waits
 * 4. Progress is tracked in the DB (sentCount, failedCount)
 */

import { prisma } from "@shen-zhen/database";
import type { Broadcast } from "@shen-zhen/database";
import { BROADCAST_BATCH_SIZE } from "@shen-zhen/shared";

/**
 * Create a new broadcast (admin action).
 */
export async function createBroadcast(
  adminUserId: number,
  message: string,
): Promise<Broadcast> {
  // Count active (non-banned) users
  const totalUsers = await prisma.user.count({
    where: { isBanned: false },
  });

  return prisma.broadcast.create({
    data: {
      message,
      sentBy: adminUserId,
      totalUsers,
      status: "queued",
    },
  });
}

/**
 * Process one batch of a broadcast.
 * Returns true if there are more users to send to.
 *
 * The actual message sending is delegated to a callback
 * because it requires the Telegram Bot API (not available in core).
 */
export async function processBroadcastBatch(
  broadcastId: number,
  sendMessage: (telegramId: bigint, message: string) => Promise<boolean>,
): Promise<{ hasMore: boolean; sentInBatch: number; failedInBatch: number }> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
  });

  if (!broadcast || broadcast.status === "cancelled") {
    return { hasMore: false, sentInBatch: 0, failedInBatch: 0 };
  }

  // Mark as sending on first batch
  if (broadcast.status === "queued") {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "sending", startedAt: new Date() },
    });
  }

  // Get next batch of users (skip already-sent count)
  const users = await prisma.user.findMany({
    where: { isBanned: false },
    select: { telegramId: true },
    orderBy: { id: "asc" },
    skip: broadcast.sentCount + broadcast.failedCount,
    take: BROADCAST_BATCH_SIZE,
  });

  if (users.length === 0) {
    // All done
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "completed", completedAt: new Date() },
    });
    return { hasMore: false, sentInBatch: 0, failedInBatch: 0 };
  }

  let sentInBatch = 0;
  let failedInBatch = 0;

  for (const user of users) {
    try {
      const success = await sendMessage(user.telegramId, broadcast.message);
      if (success) {
        sentInBatch++;
      } else {
        failedInBatch++;
      }
    } catch {
      failedInBatch++;
    }
  }

  // Update progress
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: { increment: sentInBatch },
      failedCount: { increment: failedInBatch },
    },
  });

  const totalProcessed =
    broadcast.sentCount + broadcast.failedCount + sentInBatch + failedInBatch;
  const hasMore = totalProcessed < broadcast.totalUsers;

  if (!hasMore) {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  return { hasMore, sentInBatch, failedInBatch };
}

/**
 * Cancel an active broadcast.
 */
export async function cancelBroadcast(broadcastId: number): Promise<void> {
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "cancelled" },
  });
}

/**
 * Get all broadcasts with pagination.
 */
export async function getBroadcasts(
  limit: number = 20,
  offset: number = 0,
): Promise<{ broadcasts: Broadcast[]; total: number }> {
  const [broadcasts, total] = await Promise.all([
    prisma.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.broadcast.count(),
  ]);

  return { broadcasts, total };
}
