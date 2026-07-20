/**
 * /spin — Spin the Wheel command
 *
 * Free spin every 8 hours. Paid spin costs 50 points.
 */

import { Context, InlineKeyboard } from "grammy";
import { prisma } from "@shen-zhen/database";
import { executeSpin, getSpinStatus, WHEEL_SLICES } from "@shen-zhen/core";

export async function handleSpin(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user) {
    await ctx.reply("❌ You need to /start first!");
    return;
  }

  const status = await getSpinStatus(user.id);

  if (status.canFreeSpin) {
    // Do the free spin
    const result = await executeSpin(user.id, "free");

    if (!result.success) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }

    const prize = WHEEL_SLICES[result.prizeIndex!]!;
    const isJackpot = prize.label === "JACKPOT";

    await ctx.reply(
      `🎰 <b>Spin the Wheel!</b>\n\n` +
        `${isJackpot ? "🎉🎉🎉 JACKPOT!!! 🎉🎉🎉" : "The wheel stops on..."}\n\n` +
        `💰 <b>+${result.pointsWon} points!</b> ${isJackpot ? "🤑" : "🎊"}\n\n` +
        `⏰ Next free spin in <b>8 hours</b>\n` +
        `💸 Or use /spin_paid for 50 points`,
      { parse_mode: "HTML" },
    );
  } else {
    // Show countdown
    const timeLeft = status.nextFreeSpinAt!.getTime() - Date.now();
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const mins = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    const keyboard = new InlineKeyboard()
      .text("💸 Paid Spin (50 pts)", "spin_paid");

    await ctx.reply(
      `🎰 <b>Spin the Wheel</b>\n\n` +
        `⏰ Free spin available in <b>${hours}h ${mins}m</b>\n\n` +
        `📊 Your stats:\n` +
        `• Total spins: ${status.totalSpins}\n` +
        `• Total won: ${status.totalWon.toLocaleString()} pts\n\n` +
        `Can't wait? Use a paid spin for 50 points! 👇`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
      },
    );
  }
}

/** Handle paid spin callback */
export async function handleSpinPaid(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user) {
    await ctx.answerCallbackQuery({ text: "Use /start first!" });
    return;
  }

  const result = await executeSpin(user.id, "paid");

  if (!result.success) {
    await ctx.answerCallbackQuery({ text: result.error ?? "Failed" });
    return;
  }

  const prize = WHEEL_SLICES[result.prizeIndex!]!;
  const isJackpot = prize.label === "JACKPOT";

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🎰 <b>Paid Spin!</b>\n\n` +
      `${isJackpot ? "🎉🎉🎉 JACKPOT!!! 🎉🎉🎉" : "The wheel stops on..."}\n\n` +
      `💰 <b>+${result.pointsWon} points!</b> (-50 spin cost)\n` +
      `📊 Net: <b>+${result.pointsWon! - 50} points</b>`,
    { parse_mode: "HTML" },
  );
}
