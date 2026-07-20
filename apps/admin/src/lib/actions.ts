/**
 * Admin Panel — Server Actions
 *
 * All mutations go through server actions — no client-side API calls.
 */

"use server";

import { prisma } from "@shen-zhen/database";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getSession, requireAuth } from "./session";
import {
  reviewSubmission,
  createBroadcast,
  resolveFlag,
} from "@shen-zhen/core";

// ─── Auth Actions ──────────────────────────────────
export async function loginAction(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password required" };
  }

  // Find admin user
  const admin = await prisma.adminUser.findUnique({
    where: { username },
  });

  if (!admin) {
    return { error: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return { error: "Invalid credentials" };
  }

  const session = await getSession();
  session.adminId = admin.id;
  session.username = admin.username;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

// ─── Task Submission Review ────────────────────────
export async function approveSubmissionAction(submissionId: number): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuth();
  const result = await reviewSubmission(submissionId, auth.adminId!, true);
  return result;
}

export async function rejectSubmissionAction(submissionId: number): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAuth();
  const result = await reviewSubmission(submissionId, auth.adminId!, false);
  return result;
}

// ─── User Management ──────────────────────────────
export async function banUserAction(userId: number): Promise<void> {
  await requireAuth();
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true },
  });
}

export async function unbanUserAction(userId: number): Promise<void> {
  await requireAuth();
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false },
  });
}

// ─── Task Management ──────────────────────────────
export async function createTaskAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const pointReward = parseInt(formData.get("pointReward") as string, 10);
  const type = formData.get("type") as string;
  const isRepeatable = formData.get("isRepeatable") === "true";
  const channelId = formData.get("channelId") as string | null;
  const quizAnswer = formData.get("quizAnswer") as string | null;

  if (!title || !description || !pointReward || !type) {
    return { success: false, error: "All fields required" };
  }

  const verifyData: Record<string, string> = {};
  if (type === "auto_channel" && channelId) {
    verifyData["channelId"] = channelId;
  }
  if (type === "auto_quiz" && quizAnswer) {
    verifyData["answer"] = quizAnswer;
  }

  await prisma.task.create({
    data: {
      title,
      description,
      pointReward,
      type,
      isRepeatable,
      verifyData: Object.keys(verifyData).length > 0 ? verifyData : undefined,
    },
  });

  return { success: true };
}

export async function toggleTaskAction(taskId: number, isActive: boolean): Promise<void> {
  await requireAuth();
  await prisma.task.update({
    where: { id: taskId },
    data: { isActive },
  });
}

// ─── Broadcast ────────────────────────────────────
export async function sendBroadcastAction(message: string): Promise<{ success: boolean; broadcastId?: number; error?: string }> {
  const auth = await requireAuth();

  if (!message.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  const broadcast = await createBroadcast(auth.adminId!, message);
  return { success: true, broadcastId: broadcast.id };
}

// ─── Sybil Flags ──────────────────────────────────
export async function resolveFlagAction(
  flagId: number,
  resolution: "dismissed" | "banned" | "cleared",
): Promise<void> {
  const auth = await requireAuth();
  await resolveFlag(flagId, auth.adminId!, resolution);
}
