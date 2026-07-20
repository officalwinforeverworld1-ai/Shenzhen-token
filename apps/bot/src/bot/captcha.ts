/**
 * Shén Zhèn Airdrop — Math CAPTCHA
 *
 * Simple math CAPTCHA to verify humans. Not bulletproof, but
 * meaningfully raises the cost of cheap scripted abuse.
 *
 * Flow:
 * 1. Generate two random numbers and an operation
 * 2. Present as inline keyboard buttons (one correct, three wrong)
 * 3. On correct answer, mark user as verified
 */

import { Context, InlineKeyboard } from "grammy";
import { prisma } from "@shen-zhen/database";
import { sendWelcome } from "./commands/start.js";

// In-memory CAPTCHA state (simple, stateless between restarts — acceptable)
const captchaStore = new Map<
  number,
  { answer: number; attempts: number; expiry: number }
>();

/**
 * Send a math CAPTCHA to the user.
 */
export async function sendCaptcha(
  ctx: Context,
  userId: number,
): Promise<void> {
  // Generate simple math problem
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 15) + 1;
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)]!;

  let answer: number;
  switch (op) {
    case "+":
      answer = a + b;
      break;
    case "-":
      answer = a - b;
      break;
    case "×":
      answer = a * b;
      break;
  }

  // Generate 3 wrong answers (close to correct)
  const wrongAnswers = new Set<number>();
  while (wrongAnswers.size < 3) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = answer + (offset === 0 ? 1 : offset);
    if (wrong !== answer) {
      wrongAnswers.add(wrong);
    }
  }

  // Shuffle options
  const options = [answer, ...wrongAnswers].sort(() => Math.random() - 0.5);

  // Store CAPTCHA state
  captchaStore.set(userId, {
    answer,
    attempts: 0,
    expiry: Date.now() + 120_000, // 2 minutes
  });

  // Build inline keyboard
  const keyboard = new InlineKeyboard();
  for (const opt of options) {
    keyboard.text(String(opt), `captcha_${userId}_${opt}`);
  }

  await ctx.reply(
    `🔐 <b>Verification Required</b>\n\n` +
      `Please solve this to prove you're human:\n\n` +
      `What is <b>${a} ${op} ${b}</b> ?`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
  );
}

/**
 * Handle CAPTCHA answer callback.
 */
export async function handleCaptchaCallback(
  ctx: Context,
  data: string,
): Promise<void> {
  // Parse: captcha_USERID_ANSWER
  const parts = data.split("_");
  if (parts.length < 3) return;

  const userId = parseInt(parts[1] ?? "0", 10);
  const userAnswer = parseInt(parts[2] ?? "0", 10);

  const captcha = captchaStore.get(userId);

  if (!captcha) {
    await ctx.answerCallbackQuery({
      text: "CAPTCHA expired. Use /start again.",
      show_alert: true,
    });
    return;
  }

  // Check expiry
  if (Date.now() > captcha.expiry) {
    captchaStore.delete(userId);
    await ctx.answerCallbackQuery({
      text: "⏰ CAPTCHA expired. Use /start again.",
      show_alert: true,
    });
    return;
  }

  // Check answer
  if (userAnswer === captcha.answer) {
    captchaStore.delete(userId);

    // Mark user as verified
    await prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    await ctx.answerCallbackQuery({ text: "✅ Verified!" });

    // Delete the CAPTCHA message
    try {
      await ctx.deleteMessage();
    } catch {
      // Might not have permission, that's ok
    }

    // Send welcome
    await sendWelcome(ctx, true);
  } else {
    captcha.attempts++;

    if (captcha.attempts >= 3) {
      captchaStore.delete(userId);
      await ctx.answerCallbackQuery({
        text: "❌ Too many wrong attempts. Use /start to try again.",
        show_alert: true,
      });
    } else {
      await ctx.answerCallbackQuery({
        text: `❌ Wrong answer! ${3 - captcha.attempts} attempts remaining.`,
        show_alert: true,
      });
    }
  }
}
