/**
 * /invite command — Shows referral link and stats
 */

import { Context, InlineKeyboard } from "grammy";
import { prisma } from "@shen-zhen/database";
import { getReferralStats } from "@shen-zhen/core";

export async function handleInvite(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user) {
    await ctx.reply("You haven't started yet! Use /start first.");
    return;
  }

  if (!user.isVerified) {
    await ctx.reply("Please complete verification first. Use /start.");
    return;
  }

  // Get bot username for the referral link
  const me = await ctx.api.getMe();
  const stats = await getReferralStats(user.id, me.username ?? "");

  const keyboard = new InlineKeyboard().url(
    "📤 Share Invite Link",
    `https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${encodeURIComponent("Join Shén Zhèn Airdrop and earn points! 🎮")}`,
  );

  await ctx.reply(
    `👥 <b>Your Referral Stats</b>\n\n` +
      `🔗 Your link:\n<code>${stats.referralLink}</code>\n\n` +
      `📊 <b>Stats:</b>\n` +
      `Total invited: <b>${stats.totalReferred}</b>\n` +
      `✅ Qualified: <b>${stats.qualifiedCount}</b>\n` +
      `⏳ Pending: <b>${stats.pendingCount}</b>\n` +
      `💰 Total earned: <b>${stats.totalEarned.toLocaleString()} pts</b>\n\n` +
      `<i>Referral rewards unlock when your friend completes their first task!</i>`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
}
