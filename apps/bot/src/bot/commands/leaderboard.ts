/**
 * /leaderboard command — Shows top earners + user's rank
 */

import { Context } from "grammy";
import { prisma } from "@shen-zhen/database";
import { getLeaderboard } from "@shen-zhen/core";

export async function handleLeaderboard(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user) {
    await ctx.reply("You haven't started yet! Use /start first.");
    return;
  }

  const lb = await getLeaderboard(user.id);

  // Build leaderboard text (top 10 for bot chat)
  const top10 = lb.entries.slice(0, 10);
  let text = "🏆 <b>Leaderboard — Top 10</b>\n\n";

  for (const entry of top10) {
    const medal =
      entry.rank === 1
        ? "🥇"
        : entry.rank === 2
          ? "🥈"
          : entry.rank === 3
            ? "🥉"
            : `${entry.rank}.`;

    const isMe = entry.userId === user.id;
    const name = entry.username ? `@${entry.username}` : entry.firstName;
    const line = `${medal} ${isMe ? "<b>" : ""}${name}${isMe ? "</b>" : ""} — ${entry.totalPoints.toLocaleString()} pts`;
    text += line + "\n";
  }

  // Add user's rank if not in top 10
  if (lb.userRank && lb.userRank.rank > 10) {
    text += `\n···\n\n`;
    text += `📍 Your rank: <b>#${lb.userRank.rank}</b> — ${lb.userRank.totalPoints.toLocaleString()} pts\n`;
  }

  text += `\n👥 Total participants: ${lb.totalUsers.toLocaleString()}`;

  await ctx.reply(text, { parse_mode: "HTML" });
}
