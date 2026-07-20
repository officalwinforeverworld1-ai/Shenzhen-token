/**
 * /tasks command — Lists active tasks with inline keyboard for completion
 */

import { Context, InlineKeyboard } from "grammy";
import { prisma } from "@shen-zhen/database";
import { getActiveTasks, submitTask } from "@shen-zhen/core";

export async function handleTasks(ctx: Context): Promise<void> {
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

  const tasks = await getActiveTasks(user.id);

  if (tasks.length === 0) {
    await ctx.reply(
      "📋 No active tasks right now. Check back later!\n\n" +
        "Open the Mini App to tap and earn points in the meantime 🎮",
    );
    return;
  }

  let text = "📋 <b>Available Tasks</b>\n\n";
  const keyboard = new InlineKeyboard();

  for (const task of tasks) {
    const statusIcon = task.isCompleted
      ? "✅"
      : task.canSubmit
        ? "🔵"
        : "⏳";

    text +=
      `${statusIcon} <b>${task.title}</b>\n` +
      `${task.description}\n` +
      `💰 Reward: ${task.pointReward} pts\n\n`;

    if (task.canSubmit) {
      keyboard.text(
        `${task.title} (+${task.pointReward})`,
        `task_${task.id}_${task.type}`,
      );
      keyboard.row();
    }
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

/**
 * Handle task completion from inline keyboard callback
 */
export async function handleTaskCallback(
  ctx: Context,
  data: string,
): Promise<void> {
  if (!ctx.from) return;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });

  if (!user || !user.isVerified) {
    await ctx.answerCallbackQuery({ text: "Please verify first with /start" });
    return;
  }

  // Parse callback data: task_ID_TYPE
  const parts = data.split("_");
  if (parts.length < 3) {
    await ctx.answerCallbackQuery({ text: "Invalid task" });
    return;
  }

  const taskId = parseInt(parts[1] ?? "0", 10);
  const taskType = parts.slice(2).join("_");

  if (taskType === "auto_channel") {
    // Check channel membership via bot API
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      await ctx.answerCallbackQuery({ text: "Task not found" });
      return;
    }

    const verifyData = task.verifyData as { channelId?: string } | null;
    const channelId = verifyData?.channelId;

    if (!channelId) {
      await ctx.answerCallbackQuery({ text: "Task misconfigured" });
      return;
    }

    try {
      const member = await ctx.api.getChatMember(channelId, ctx.from.id);
      const isMember = ["member", "administrator", "creator"].includes(
        member.status,
      );

      if (!isMember) {
        await ctx.answerCallbackQuery({
          text: "❌ You haven't joined the channel yet!",
          show_alert: true,
        });
        return;
      }

      // Submit with verified membership
      const result = await submitTask(user.id, taskId, "bot", {
        channelMembershipVerified: true,
      });

      if (result.success) {
        await ctx.answerCallbackQuery({
          text: `✅ +${result.pointsAwarded} points!`,
          show_alert: true,
        });
      } else {
        await ctx.answerCallbackQuery({
          text: result.error ?? "Could not complete task",
          show_alert: true,
        });
      }
    } catch {
      await ctx.answerCallbackQuery({
        text: "Could not verify membership",
        show_alert: true,
      });
    }
  } else if (taskType === "auto_quiz") {
    // For quiz tasks, we'd need to ask the question first
    // For now, show a message directing to Mini App
    await ctx.answerCallbackQuery({
      text: "📝 Open the Mini App to complete quiz tasks!",
      show_alert: true,
    });
  } else if (taskType === "manual") {
    await ctx.answerCallbackQuery({
      text: "📸 Open the Mini App to submit proof for this task!",
      show_alert: true,
    });
  }
}
