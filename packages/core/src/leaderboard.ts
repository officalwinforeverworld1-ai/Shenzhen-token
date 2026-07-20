/**
 * Shén Zhèn Airdrop — Leaderboard Engine
 *
 * Global leaderboard with user's own rank always visible.
 */

import { prisma } from "@shen-zhen/database";
import type { LeaderboardEntry, LeaderboardResponse } from "@shen-zhen/shared";
import { LEADERBOARD_SIZE } from "@shen-zhen/shared";

/**
 * Get the leaderboard with the requesting user's rank always included.
 */
export async function getLeaderboard(
  userId?: number,
): Promise<LeaderboardResponse> {
  // Get top N users by total points
  // Using raw query for efficient SUM + ranking
  const topEntries = await prisma.$queryRaw<
    { userId: number; firstName: string; username: string | null; totalPoints: bigint }[]
  >`
    SELECT 
      u.id as "userId",
      u."firstName",
      u.username,
      COALESCE(SUM(pl.amount), 0) as "totalPoints"
    FROM "User" u
    LEFT JOIN "PointLedger" pl ON pl."userId" = u.id
    WHERE u."isBanned" = false
    GROUP BY u.id, u."firstName", u.username
    ORDER BY "totalPoints" DESC
    LIMIT ${LEADERBOARD_SIZE}
  `;

  const entries: LeaderboardEntry[] = topEntries.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    firstName: entry.firstName,
    username: entry.username,
    totalPoints: Number(entry.totalPoints),
  }));

  // Get total user count
  const totalUsers = await prisma.user.count({
    where: { isBanned: false },
  });

  // Get the requesting user's rank if they're not in the top N
  let userRank: LeaderboardEntry | null = null;

  if (userId) {
    const inTopN = entries.find((e) => e.userId === userId);

    if (inTopN) {
      userRank = inTopN;
    } else {
      // Calculate user's rank using a subquery
      const rankResult = await prisma.$queryRaw<
        { rank: bigint; totalPoints: bigint; firstName: string; username: string | null }[]
      >`
        SELECT 
          sub.rank,
          sub."totalPoints",
          sub."firstName",
          sub.username
        FROM (
          SELECT 
            u.id,
            u."firstName",
            u.username,
            COALESCE(SUM(pl.amount), 0) as "totalPoints",
            RANK() OVER (ORDER BY COALESCE(SUM(pl.amount), 0) DESC) as rank
          FROM "User" u
          LEFT JOIN "PointLedger" pl ON pl."userId" = u.id
          WHERE u."isBanned" = false
          GROUP BY u.id, u."firstName", u.username
        ) sub
        WHERE sub.id = ${userId}
      `;

      if (rankResult.length > 0) {
        const r = rankResult[0]!;
        userRank = {
          rank: Number(r.rank),
          userId,
          firstName: r.firstName,
          username: r.username,
          totalPoints: Number(r.totalPoints),
        };
      }
    }
  }

  return {
    entries,
    userRank,
    totalUsers,
  };
}
