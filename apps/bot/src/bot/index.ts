/**
 * Shén Zhèn Airdrop — Bot Setup & Command Registration
 *
 * Registers all commands, middleware, and conversation flows.
 */

import { Bot, Context } from "grammy";
import { handleStart } from "./commands/start.js";
import { handleBalance } from "./commands/balance.js";
import { handleLeaderboard } from "./commands/leaderboard.js";
import { handleInvite } from "./commands/invite.js";
import { handleTasks } from "./commands/tasks.js";
import { handleDaily } from "./commands/daily.js";
import { handleSpin, handleSpinPaid } from "./commands/spin.js";

// Session data for CAPTCHA flow
export interface SessionData {
  captchaAnswer?: number;
  captchaAttempts?: number;
  captchaExpiry?: number;
  awaitingCaptcha?: boolean;
}

export type BotContext = Context & { session: SessionData };

export function setupBot(bot: Bot): void {
  // ─── Error Handler ──────────────────────────────────
  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  // ─── Commands ───────────────────────────────────────
  bot.command("start", handleStart);
  bot.command("balance", handleBalance);
  bot.command("leaderboard", handleLeaderboard);
  bot.command("invite", handleInvite);
  bot.command("tasks", handleTasks);
  bot.command("daily", handleDaily);
  bot.command("spin", handleSpin);

  // ─── Callback Queries (inline keyboard buttons) ─────
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Welcome message inline buttons
    if (data === "cmd_balance") {
      await handleBalance(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "cmd_tasks") {
      await handleTasks(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "cmd_invite") {
      await handleInvite(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "cmd_leaderboard") {
      await handleLeaderboard(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "cmd_daily") {
      await handleDaily(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "cmd_spin") {
      await handleSpin(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "spin_paid") {
      await handleSpinPaid(ctx);
    } else if (data.startsWith("task_")) {
      const { handleTaskCallback } = await import("./commands/tasks.js");
      await handleTaskCallback(ctx, data);
    } else if (data.startsWith("captcha_")) {
      const { handleCaptchaCallback } = await import("./captcha.js");
      await handleCaptchaCallback(ctx, data);
    } else {
      await ctx.answerCallbackQuery({ text: "Unknown action" });
    }
  });

  // Set bot commands menu
  bot.api.setMyCommands([
    { command: "start", description: "Start the bot / onboarding" },
    { command: "balance", description: "Check your point balance" },
    { command: "daily", description: "Daily check-in for streak bonus" },
    { command: "spin", description: "Spin the wheel for prizes" },
    { command: "tasks", description: "View available tasks" },
    { command: "invite", description: "Get your referral link" },
    { command: "leaderboard", description: "View the leaderboard" },
  ]).catch(console.error);
}
