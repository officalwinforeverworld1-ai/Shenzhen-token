/**
 * /balance command — Shows user's current point balance
 */

import { Context } from "grammy";
import { prisma } from "@shen-zhen/database";
import { getBalance, getEnergyState } from "@shen-zhen/core";

export async function handleBalance(ctx: Context): Promise<void> {
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

  const balance = await getBalance(user.id);
  const energy = getEnergyState(user);

  await ctx.reply(
    `💰 <b>Your Balance</b>\n\n` +
      `Points: <b>${balance.toLocaleString()}</b>\n` +
      `⚡ Energy: ${energy.current}/${energy.max}\n` +
      `💪 Tap Power: ${user.tapPower}x\n` +
      `🔄 Regen: ${user.energyRegenRate}/sec\n\n` +
      `Open the Mini App to tap and earn more! 🎮`,
    { parse_mode: "HTML" },
  );
}
