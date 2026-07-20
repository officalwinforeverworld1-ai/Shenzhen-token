/**
 * Mini App — API Client
 *
 * Typed API calls to the bot server. Handles auth token management.
 */

let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
  localStorage.setItem("shen_zhen_token", token);
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem("shen_zhen_token");
  }
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
  localStorage.removeItem("shen_zhen_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Network error" }));
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Auth ──────────────────────────────────────────
export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: UserProfile;
  };
}

export interface UserProfile {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  balance: number;
  energy: EnergyState;
  tapPower: number;
  energyRegenRate?: number;
  rank?: number | null;
  isVerified: boolean;
  referralCount?: number;
  walletAddress?: string | null;
}

export interface EnergyState {
  current: number;
  max: number;
  regenRate: number;
  secondsToFull: number;
}

export async function authenticate(initData: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth", {
    method: "POST",
    body: JSON.stringify({ initData }),
  });
}

/**
 * Dev-mode authentication — creates a real DB user + JWT.
 * Only works when bot is running in local polling mode.
 */
export async function devAuth(): Promise<AuthResponse> {
  return request<AuthResponse>("/dev-auth", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getProfile(): Promise<{ success: boolean; data: UserProfile }> {
  return request("/user/me");
}

// ─── Tap ───────────────────────────────────────────
export interface TapResponse {
  success: boolean;
  pointsEarned: number;
  newBalance: number;
  energy: EnergyState;
  error?: string;
}

export async function submitTaps(tapCount: number): Promise<TapResponse> {
  return request<TapResponse>("/tap", {
    method: "POST",
    body: JSON.stringify({ tapCount }),
  });
}

/** Alias used by Home page */
export async function tap(tapCount: number): Promise<{ success: boolean; data: { balance: number; energy: EnergyState } }> {
  const res = await submitTaps(tapCount);
  return { success: res.success && !res.error, data: { balance: res.newBalance, energy: res.energy } };
}

// ─── Tasks ─────────────────────────────────────────
export interface TaskView {
  id: number;
  title: string;
  description: string;
  pointReward: number;
  type: string;
  isCompleted: boolean;
  canSubmit: boolean;
  cooldownEndsAt: string | null;
}

export async function getTasks(): Promise<{ success: boolean; data: TaskView[] }> {
  return request("/tasks");
}

export async function submitTaskCompletion(
  taskId: number,
  options: { proof?: string; answer?: string } = {},
): Promise<{ success: boolean; status: string; pointsAwarded?: number; error?: string }> {
  return request("/tasks/submit", {
    method: "POST",
    body: JSON.stringify({ taskId, ...options }),
  });
}

// ─── Leaderboard ───────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  userId: number;
  firstName: string;
  username: string | null;
  totalPoints: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  totalUsers: number;
}

export async function getLeaderboard(): Promise<{ success: boolean; data: LeaderboardResponse }> {
  return request("/leaderboard");
}

// ─── Referrals ─────────────────────────────────────
export interface ReferralStats {
  referralLink: string;
  totalReferred: number;
  qualifiedCount: number;
  pendingCount: number;
  totalEarned: number;
}

export async function getReferrals(): Promise<{ success: boolean; data: ReferralStats }> {
  return request("/referrals");
}

// ─── Upgrades ──────────────────────────────────────
export interface UpgradeView {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: string;
  currentLevel: number;
  maxLevel: number;
  nextCost: number | null;
  currentEffect: number;
  nextEffect: number | null;
  iconEmoji: string;
  canAfford: boolean;
}

export interface UpgradeResult {
  success: boolean;
  newBalance: number;
  newLevel: number;
  appliedEffect: string;
}

export async function getUpgrades(): Promise<{ success: boolean; data: UpgradeView[] }> {
  return request("/upgrades");
}

export async function purchaseUpgrade(upgradeId: number): Promise<UpgradeResult> {
  return request<UpgradeResult>("/upgrades/purchase", {
    method: "POST",
    body: JSON.stringify({ upgradeId }),
  });
}

// ─── Daily Check-in ────────────────────────────────
export interface CheckinResponse {
  success: boolean;
  data: {
    alreadyCheckedIn: boolean;
    streak: number;
    pointsAwarded: number;
    nextReward: number;
  };
}

export async function dailyCheckin(): Promise<CheckinResponse> {
  return request<CheckinResponse>("/checkin", { method: "POST" });
}

export async function getCheckinStatus(): Promise<{
  success: boolean;
  data: { currentStreak: number; checkedInToday: boolean; todayReward: number };
}> {
  return request("/checkin/status");
}

// ─── Spin Wheel ────────────────────────────────────
export interface SpinResponse {
  success: boolean;
  data: {
    prizeIndex: number;
    pointsWon: number;
    label: string;
    nextFreeSpinAt: string | null;
  };
  error?: string;
}

export async function spinWheel(type: "free" | "paid" = "free"): Promise<SpinResponse> {
  return request<SpinResponse>("/spin", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export async function getSpinStatus(): Promise<{
  success: boolean;
  data: { canFreeSpin: boolean; nextFreeSpinAt: string | null; totalSpins: number; totalWon: number };
}> {
  return request("/spin/status");
}

// ─── Wallet (TON) ──────────────────────────────────
export async function connectWallet(
  walletAddress: string,
): Promise<{ success: boolean; data?: { walletAddress: string }; error?: string }> {
  return request("/wallet/connect", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
}

export async function disconnectWallet(): Promise<{ success: boolean }> {
  return request("/wallet/disconnect", { method: "POST" });
}
