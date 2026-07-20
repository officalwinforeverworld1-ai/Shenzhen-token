/**
 * Shén Zhèn Airdrop — Zod Validators
 *
 * Input validation schemas shared across API routes.
 * Every user-facing input goes through these before hitting business logic.
 */

import { z } from "zod";
import { MAX_TAP_BATCH_SIZE } from "./constants.js";

// ─── Tap Request ────────────────────────────────────────
export const TapRequestSchema = z.object({
  tapCount: z
    .number()
    .int()
    .min(1, "Must tap at least once")
    .max(MAX_TAP_BATCH_SIZE, `Maximum ${MAX_TAP_BATCH_SIZE} taps per batch`),
});

export type TapRequest = z.infer<typeof TapRequestSchema>;

// ─── Task Submission ────────────────────────────────────
export const TaskSubmissionRequestSchema = z.object({
  taskId: z.number().int().positive(),
  proof: z.string().max(2000).optional(), // URL or text proof for manual tasks
  answer: z.string().max(500).optional(), // answer for quiz tasks
});

export type TaskSubmissionRequest = z.infer<
  typeof TaskSubmissionRequestSchema
>;

// ─── Upgrade Purchase ───────────────────────────────────
export const UpgradePurchaseRequestSchema = z.object({
  upgradeId: z.number().int().positive(),
});

export type UpgradePurchaseRequest = z.infer<
  typeof UpgradePurchaseRequestSchema
>;

// ─── Admin: Task CRUD ───────────────────────────────────
export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  pointReward: z.number().int().positive(),
  type: z.enum(["auto_channel", "auto_quiz", "manual"]),
  verifyData: z
    .object({
      channelId: z.string().optional(),
      question: z.string().optional(),
      answer: z.string().optional(),
    })
    .nullable()
    .optional(),
  isRepeatable: z.boolean().default(false),
  repeatCooldown: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().default(0),
  maxCompletions: z.number().int().positive().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ─── Admin: Submission Review ───────────────────────────
export const ReviewSubmissionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export type ReviewSubmissionInput = z.infer<typeof ReviewSubmissionSchema>;

// ─── Admin: User Actions ────────────────────────────────
export const UserActionSchema = z.object({
  action: z.enum(["ban", "unban"]),
});

export type UserActionInput = z.infer<typeof UserActionSchema>;

// ─── Admin: Broadcast ───────────────────────────────────
export const CreateBroadcastSchema = z.object({
  message: z.string().min(1).max(4096), // Telegram message limit
});

export type CreateBroadcastInput = z.infer<typeof CreateBroadcastSchema>;

// ─── Admin: Login ───────────────────────────────────────
export const AdminLoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

// ─── Admin: Point Adjustment ────────────────────────────
export const PointAdjustmentSchema = z.object({
  userId: z.number().int().positive(),
  amount: z.number().int(), // can be negative for deductions
  reason: z.string().min(1).max(500),
});

export type PointAdjustmentInput = z.infer<typeof PointAdjustmentSchema>;

// ─── Pagination ─────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ─── Search ─────────────────────────────────────────────
export const UserSearchSchema = z.object({
  query: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UserSearchInput = z.infer<typeof UserSearchSchema>;
