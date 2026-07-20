/**
 * Shén Zhèn Airdrop — Shared Types
 *
 * Types used across bot, admin panel, and mini app.
 * These are the API/interface types, NOT the database models
 * (those come from @shen-zhen/database).
 */

// ─── Point Reasons ──────────────────────────────────────
export type PointReason =
  | "task_completion"
  | "referral_reward"
  | "tap"
  | "upgrade_purchase"
  | "admin_adjustment"
  | "welcome_bonus"
  | "daily_checkin"
  | "spin_reward"
  | "spin_purchase";

export type SourceType = "bot" | "mini_app" | "admin";

// ─── Task Types ─────────────────────────────────────────
export type TaskType = "auto_channel" | "auto_quiz" | "manual";

export type SubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_approved";

// ─── Referral Status ────────────────────────────────────
export type ReferralStatus = "pending" | "qualified" | "rewarded";

// ─── Sybil Flag Types ───────────────────────────────────
export type SybilFlagType =
  | "rapid_referrals"
  | "similar_names"
  | "new_account_burst"
  | "suspicious_pattern";

export type SybilSeverity = "low" | "medium" | "high";
export type SybilResolution = "dismissed" | "banned" | "cleared";

// ─── Upgrade Types ──────────────────────────────────────
export type UpgradeType = "tap_power" | "max_energy" | "energy_regen";

// ─── Admin Roles ────────────────────────────────────────
export type AdminRole = "admin" | "moderator";

// ─── Broadcast Status ───────────────────────────────────
export type BroadcastStatus = "queued" | "sending" | "completed" | "cancelled";

// ─── API Response Types ─────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserProfile {
  id: number;
  telegramId: string; // serialized BigInt
  username: string | null;
  firstName: string;
  balance: number;
  energy: number;
  maxEnergy: number;
  tapPower: number;
  energyRegenRate: number;
  energyUpdatedAt: string; // ISO timestamp
  referralCount: number;
  rank: number | null;
  isVerified: boolean;
}

export interface EnergyState {
  current: number;
  max: number;
  regenRate: number;
  secondsToFull: number;
}

export interface TapResult {
  pointsEarned: number;
  newBalance: number;
  energy: EnergyState;
}

export interface TaskView {
  id: number;
  title: string;
  description: string;
  pointReward: number;
  type: TaskType;
  isCompleted: boolean;
  canSubmit: boolean; // false if completed and non-repeatable, or on cooldown
  cooldownEndsAt: string | null; // ISO timestamp, for repeatable tasks
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  firstName: string;
  username: string | null;
  totalPoints: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null; // always included, even if not in top N
  totalUsers: number;
}

export interface ReferralStats {
  referralLink: string;
  totalReferred: number;
  qualifiedCount: number;
  pendingCount: number;
  totalEarned: number; // total referral points earned
}

export interface UpgradeView {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: UpgradeType;
  currentLevel: number;
  maxLevel: number;
  nextCost: number | null; // null if max level
  currentEffect: number;
  nextEffect: number | null;
  iconEmoji: string;
  canAfford: boolean;
}

export interface UpgradeResult {
  success: boolean;
  newBalance: number;
  newLevel: number;
  appliedEffect: string; // human-readable description
}

// ─── Auth Types ─────────────────────────────────────────
export interface TelegramAuthPayload {
  telegramId: bigint;
  username?: string;
  firstName: string;
  lastName?: string;
  authDate: number;
}

export interface JwtPayload {
  userId: number;
  telegramId: string;
  iat: number;
  exp: number;
}
