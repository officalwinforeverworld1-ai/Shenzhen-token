/**
 * Shén Zhèn Airdrop — Core Engine Exports
 *
 * This is the brain of the system. Every point award, referral,
 * energy calculation, upgrade purchase, and task completion goes
 * through these functions.
 *
 * Both the bot and Mini App API call these — NEVER bypass them.
 */

// Points Engine — the single award path
export {
  awardPoints,
  spendPoints,
  getBalance,
  getLedgerHistory,
  awardTapPoints,
} from "./points.js";
export type { AwardResult, SpendResult } from "./points.js";

// Referral Engine — atomic qualification
export {
  createReferral,
  qualifyReferral,
  getReferralStats,
  getReferralList,
  parseReferralCode,
} from "./referrals.js";
export type { ReferralCreateResult, QualifyResult } from "./referrals.js";

// Energy System — server-authoritative tap-to-earn
export {
  calculateCurrentEnergy,
  getEnergyState,
  processTaps,
  cleanupTapRateLimiter,
} from "./energy.js";

// Upgrade System — spend points to boost stats
export {
  getAvailableUpgrades,
  purchaseUpgrade,
  calculateUpgradeCost,
  calculateUpgradeEffect,
} from "./upgrades.js";

// Task Engine — task listing, submission, review
export {
  getActiveTasks,
  submitTask,
  reviewSubmission,
  getPendingSubmissions,
} from "./tasks.js";

// Leaderboard
export { getLeaderboard } from "./leaderboard.js";

// Anti-Sybil — background fraud detection
export {
  checkAndFlagSuspicious,
  getUnresolvedFlags,
  resolveFlag,
} from "./anti-sybil.js";

// Broadcast — queued message blasts
export {
  createBroadcast,
  processBroadcastBatch,
  cancelBroadcast,
  getBroadcasts,
} from "./broadcast.js";

// Daily Check-in — streak rewards
export {
  dailyCheckin,
  getCheckinStatus,
} from "./daily-checkin.js";
export type { CheckinResult } from "./daily-checkin.js";

// Spin the Wheel — lucky draw game
export {
  executeSpin,
  getSpinStatus,
  WHEEL_SLICES,
} from "./spin.js";
export type { SpinResult, SpinStatus } from "./spin.js";
