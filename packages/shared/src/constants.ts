/**
 * Shén Zhèn Airdrop — Constants
 *
 * All magic numbers and config values live here.
 * Change these to tune the game economy.
 */

// ─── Energy System Defaults ─────────────────────────────
/** Starting energy for new users */
export const DEFAULT_ENERGY = 1000;

/** Starting max energy capacity */
export const DEFAULT_MAX_ENERGY = 1000;

/** Energy regenerated per second (base, before upgrades) */
export const DEFAULT_ENERGY_REGEN_RATE = 1.0;

/** Points earned per tap (base, before upgrades) */
export const DEFAULT_TAP_POWER = 1;

/** Maximum taps the server will accept in a single batch request */
export const MAX_TAP_BATCH_SIZE = 100;

/** Minimum milliseconds between tap batch submissions from same user */
export const TAP_BATCH_COOLDOWN_MS = 400;

// ─── Referral System ────────────────────────────────────
/** Points awarded to referrer when referee qualifies */
export const REFERRAL_REWARD_POINTS = 50;

/** Maximum referrals a user can make per hour (anti-farming) */
export const MAX_REFERRALS_PER_HOUR = 10;

/** Maximum referrals a user can make per day */
export const MAX_REFERRALS_PER_DAY = 50;

// ─── Leaderboard ────────────────────────────────────────
/** Number of top users shown on the leaderboard */
export const LEADERBOARD_SIZE = 50;

// ─── CAPTCHA ────────────────────────────────────────────
/** Time in seconds before CAPTCHA expires */
export const CAPTCHA_EXPIRY_SECONDS = 120;

/** Maximum CAPTCHA attempts before temporary lockout */
export const MAX_CAPTCHA_ATTEMPTS = 3;

/** Lockout duration in seconds after max CAPTCHA failures */
export const CAPTCHA_LOCKOUT_SECONDS = 300;

// ─── Anti-Sybil Thresholds ─────────────────────────────
/** Flag if user gets N+ referrals in one hour */
export const SYBIL_RAPID_REFERRAL_THRESHOLD = 5;

/** Flag if new account earns N+ points in first hour */
export const SYBIL_NEW_ACCOUNT_BURST_THRESHOLD = 500;

// ─── Broadcast ──────────────────────────────────────────
/** Messages per second (Telegram limit for bots is ~30/sec) */
export const BROADCAST_RATE_LIMIT = 25;

/** Batch size for broadcast processing */
export const BROADCAST_BATCH_SIZE = 50;

/** Delay between batches in milliseconds */
export const BROADCAST_BATCH_DELAY_MS = 2000;

// ─── JWT / Auth ─────────────────────────────────────────
/** initData max age in seconds (reject replays older than this) */
export const INIT_DATA_MAX_AGE_SECONDS = 86400; // 24 hours

// ─── Point Reasons (string constants) ───────────────────
export const POINT_REASONS = {
  TASK_COMPLETION: "task_completion",
  REFERRAL_REWARD: "referral_reward",
  TAP: "tap",
  UPGRADE_PURCHASE: "upgrade_purchase",
  ADMIN_ADJUSTMENT: "admin_adjustment",
} as const;

export const SOURCE_TYPES = {
  BOT: "bot",
  MINI_APP: "mini_app",
  ADMIN: "admin",
} as const;

// ─── Bot Deep Link ──────────────────────────────────────
/** Prefix for referral deep links: t.me/BOT_USERNAME?start=ref_USERID */
export const REFERRAL_DEEP_LINK_PREFIX = "ref_";
