/**
 * /daily — Daily check-in command
 *
 * Shows streak info and awards daily bonus.
 */

import { Context } from "grammy";
import { prisma } from "@shen-zhen/database";
import { dailyCheckin, getCheckinStatus } from "@shen-zhen/core";

export async function handleDaily(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user) {
    await ctx.reply("❌ You need to /start first!");
    return;
  }

  const result = await dailyCheckin(user.id);

  if (result.alreadyCheckedIn) {
    const status = await getCheckinStatus(user.id);
    await ctx.reply(
      `📅 <b>Daily Check-in</b>\n\n` +
        `✅ You've already checked in today!\n\n` +
        `🔥 Current streak: <b>${status.currentStreak} days</b>\n` +
        `📈 Tomorrow's reward: <b>${status.todayReward} points</b>\n\n` +
        `Come back tomorrow to keep your streak alive! 💪`,
      { parse_mode: "HTML" },
    );
    return;
  }

  // Streak milestone emojis
  let streakEmoji = "🔥";
  if (result.streak >= 7) streakEmoji = "💎";
  else if (result.streak >= 5) streakEmoji = "⭐";
  else if (result.streak >= 3) streakEmoji = "🏆";

  // Build streak progress bar
  const maxDisplay = 7;
  const filled = Math.min(result.streak, maxDisplay);
  const bar = "🟢".repeat(filled) + "⚪".repeat(maxDisplay - filled);

  await ctx.reply(
    `📅 <b>Daily Check-in</b>\n\n` +
      `${streakEmoji} <b>Day ${result.streak}</b> — +${result.pointsAwarded} points!\n\n` +
      `Streak: ${bar}\n\n` +
      `📈 Tomorrow's reward: <b>${result.nextReward} points</b>\n\n` +
      `${result.streak >= 7 ? "🎉 MAX STREAK! You're earning 500 pts/day!" : "Keep it going! 💪"}`,
    { parse_mode: "HTML" },
  );
}
