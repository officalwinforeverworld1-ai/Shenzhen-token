/**
 * Shén Zhèn Airdrop — Task Engine
 *
 * Handles task listing, submission, auto-verification, and manual review.
 *
 * Task types:
 * - auto_channel: verifies user joined a Telegram channel (checked via bot API)
 * - auto_quiz: verifies user answered a question correctly
 * - manual: requires proof submission, reviewed by admin
 */

import { prisma } from "@shen-zhen/database";
import type { Task, TaskSubmission } from "@shen-zhen/database";
import type { TaskView, SubmissionStatus, SourceType } from "@shen-zhen/shared";
import { POINT_REASONS, SOURCE_TYPES } from "@shen-zhen/shared";
import { awardPoints } from "./points.js";
import { qualifyReferral } from "./referrals.js";

/**
 * Get all active tasks with the user's completion status.
 */
export async function getActiveTasks(userId: number): Promise<TaskView[]> {
  const [tasks, submissions] = await Promise.all([
    prisma.task.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.taskSubmission.findMany({
      where: {
        userId,
        status: { in: ["approved", "auto_approved"] },
      },
    }),
  ]);

  // Build a map of completed task IDs
  const completedMap = new Map<number, TaskSubmission>();
  const lastSubmissionMap = new Map<number, Date>();

  for (const sub of submissions) {
    completedMap.set(sub.taskId, sub);
    const existing = lastSubmissionMap.get(sub.taskId);
    if (!existing || sub.createdAt > existing) {
      lastSubmissionMap.set(sub.taskId, sub.createdAt);
    }
  }

  return tasks.map((task): TaskView => {
    const completed = completedMap.has(task.id);
    let canSubmit = !completed;
    let cooldownEndsAt: string | null = null;

    // For repeatable tasks, check cooldown
    if (task.isRepeatable && completed && task.repeatCooldown) {
      const lastCompletion = lastSubmissionMap.get(task.id);
      if (lastCompletion) {
        const cooldownEnd = new Date(
          lastCompletion.getTime() + task.repeatCooldown * 1000,
        );
        if (cooldownEnd > new Date()) {
          canSubmit = false;
          cooldownEndsAt = cooldownEnd.toISOString();
        } else {
          canSubmit = true; // cooldown has passed
        }
      }
    } else if (task.isRepeatable && completed) {
      canSubmit = true; // repeatable, no cooldown
    }

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      pointReward: task.pointReward,
      type: task.type as TaskView["type"],
      isCompleted: completed,
      canSubmit,
      cooldownEndsAt,
    };
  });
}

/**
 * Submit a task for completion.
 *
 * For auto-verified tasks (channel, quiz), verification happens here.
 * For manual tasks, creates a pending submission for admin review.
 *
 * Channel membership check is delegated to the caller (bot) since it
 * requires the Telegram Bot API. The caller passes `autoVerifyResult`.
 */
export async function submitTask(
  userId: number,
  taskId: number,
  sourceType: SourceType,
  options: {
    proof?: string;
    quizAnswer?: string;
    channelMembershipVerified?: boolean; // set by bot after checking
  } = {},
): Promise<{
  success: boolean;
  status: SubmissionStatus;
  pointsAwarded?: number;
  error?: string;
}> {
  // Fetch the task
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.isActive) {
    return { success: false, status: "rejected", error: "Task not found or inactive" };
  }

  // Check if user is banned
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBanned) {
    return { success: false, status: "rejected", error: "User is banned" };
  }

  // Check for existing non-repeatable completion
  if (!task.isRepeatable) {
    const existingSubmission = await prisma.taskSubmission.findFirst({
      where: {
        userId,
        taskId,
        status: { in: ["approved", "auto_approved", "pending"] },
      },
    });

    if (existingSubmission) {
      return {
        success: false,
        status: existingSubmission.status as SubmissionStatus,
        error: "Task already completed or pending",
      };
    }
  }

  // For repeatable tasks, check cooldown
  if (task.isRepeatable && task.repeatCooldown) {
    const lastSubmission = await prisma.taskSubmission.findFirst({
      where: {
        userId,
        taskId,
        status: { in: ["approved", "auto_approved"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastSubmission) {
      const cooldownEnd = new Date(
        lastSubmission.createdAt.getTime() + task.repeatCooldown * 1000,
      );
      if (cooldownEnd > new Date()) {
        return {
          success: false,
          status: "rejected",
          error: `Cooldown active until ${cooldownEnd.toISOString()}`,
        };
      }
    }
  }

  // Handle by task type
  switch (task.type) {
    case "auto_channel": {
      // Channel membership must be verified by the bot caller
      if (!options.channelMembershipVerified) {
        return {
          success: false,
          status: "rejected",
          error: "Channel membership not verified",
        };
      }

      // Auto-approve and award points
      const submission = await prisma.taskSubmission.create({
        data: {
          userId,
          taskId,
          status: "auto_approved",
        },
      });

      const award = await awardPoints(
        userId,
        task.pointReward,
        POINT_REASONS.TASK_COMPLETION as "task_completion",
        sourceType,
        `task_${taskId}_sub_${submission.id}`,
        { taskTitle: task.title, taskType: task.type },
      );

      // Check if this is the user's first task completion → qualify referral
      await maybeQualifyReferral(userId);

      return {
        success: true,
        status: "auto_approved",
        pointsAwarded: award.success ? task.pointReward : 0,
      };
    }

    case "auto_quiz": {
      // Verify the quiz answer
      const verifyData = task.verifyData as { answer?: string } | null;
      const correctAnswer = verifyData?.answer?.toLowerCase().trim();
      const userAnswer = options.quizAnswer?.toLowerCase().trim();

      if (!correctAnswer || !userAnswer || userAnswer !== correctAnswer) {
        return {
          success: false,
          status: "rejected",
          error: "Incorrect answer",
        };
      }

      const submission = await prisma.taskSubmission.create({
        data: {
          userId,
          taskId,
          status: "auto_approved",
        },
      });

      const award = await awardPoints(
        userId,
        task.pointReward,
        POINT_REASONS.TASK_COMPLETION as "task_completion",
        sourceType,
        `task_${taskId}_sub_${submission.id}`,
        { taskTitle: task.title, taskType: task.type },
      );

      await maybeQualifyReferral(userId);

      return {
        success: true,
        status: "auto_approved",
        pointsAwarded: award.success ? task.pointReward : 0,
      };
    }

    case "manual": {
      if (!options.proof) {
        return {
          success: false,
          status: "rejected",
          error: "Proof is required for manual tasks",
        };
      }

      // Create pending submission for admin review
      await prisma.taskSubmission.create({
        data: {
          userId,
          taskId,
          status: "pending",
          proof: options.proof,
        },
      });

      return {
        success: true,
        status: "pending",
      };
    }

    default:
      return {
        success: false,
        status: "rejected",
        error: `Unknown task type: ${task.type}`,
      };
  }
}

/**
 * Admin reviews a submission (approve/reject).
 * If approved, awards points to the user.
 */
export async function reviewSubmission(
  submissionId: number,
  adminUserId: number,
  approved: boolean,
): Promise<{ success: boolean; pointsAwarded?: number; error?: string }> {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });

  if (!submission) {
    return { success: false, error: "Submission not found" };
  }

  if (submission.status !== "pending") {
    return { success: false, error: `Submission already ${submission.status}` };
  }

  const newStatus = approved ? "approved" : "rejected";

  await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: {
      status: newStatus,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    },
  });

  if (approved) {
    const award = await awardPoints(
      submission.userId,
      submission.task.pointReward,
      POINT_REASONS.TASK_COMPLETION as "task_completion",
      SOURCE_TYPES.ADMIN as "admin",
      `task_${submission.taskId}_sub_${submission.id}`,
      {
        taskTitle: submission.task.title,
        taskType: submission.task.type,
        reviewedBy: adminUserId,
      },
    );

    await maybeQualifyReferral(submission.userId);

    return {
      success: true,
      pointsAwarded: award.success ? submission.task.pointReward : 0,
    };
  }

  return { success: true };
}



/**
 * Check if this is the user's first approved task → qualify their referral.
 * Called after every task completion.
 */
async function maybeQualifyReferral(userId: number): Promise<void> {
  // Count user's approved/auto_approved submissions
  const completedCount = await prisma.taskSubmission.count({
    where: {
      userId,
      status: { in: ["approved", "auto_approved"] },
    },
  });

  // If this is their first completion, qualify the referral
  if (completedCount === 1) {
    await qualifyReferral(userId);
  }
}

/**
 * Get pending submissions for admin review.
 */
export async function getPendingSubmissions(
  limit: number = 20,
  offset: number = 0,
): Promise<{ submissions: (TaskSubmission & { task: Task; user: { id: number; firstName: string; username: string | null } })[]; total: number }> {
  const [submissions, total] = await Promise.all([
    prisma.taskSubmission.findMany({
      where: { status: "pending" },
      include: {
        task: true,
        user: {
          select: { id: true, firstName: true, username: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.taskSubmission.count({ where: { status: "pending" } }),
  ]);

  return { submissions: submissions as typeof submissions, total };
}
