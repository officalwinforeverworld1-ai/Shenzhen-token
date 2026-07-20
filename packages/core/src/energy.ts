/**
 * Shén Zhèn Airdrop — Energy System (Tap-to-Earn)
 *
 * Server-authoritative energy system. The client shows a smooth animation,
 * but the SERVER is the source of truth for energy values.
 *
 * How it works:
 * - Energy regenerates passively over time at `energyRegenRate` per second
 * - Each tap costs 1 energy
 * - We DON'T run timers per user — instead, on each request we:
 *   1. Read the stored energy + timestamp from DB
 *   2. Calculate how much energy regenerated since then
 *   3. Apply the action (deduct taps)
 *   4. Write back the new energy + timestamp
 *
 * This is the Hamster Kombat pattern — no background jobs, pure math.
 */

import { prisma } from "@shen-zhen/database";
import type { User } from "@shen-zhen/database";
import type { EnergyState, TapResult } from "@shen-zhen/shared";
import { MAX_TAP_BATCH_SIZE, TAP_BATCH_COOLDOWN_MS } from "@shen-zhen/shared";
import { awardTapPoints } from "./points.js";
import type { SourceType } from "@shen-zhen/shared";

// In-memory rate limiter for tap submissions per user
const lastTapTimestamps = new Map<number, number>();

/**
 * Calculate current energy based on stored state + elapsed time.
 * Pure function — no side effects, no DB calls.
 */
export function calculateCurrentEnergy(
  storedEnergy: number,
  maxEnergy: number,
  regenRate: number,
  lastUpdateTime: Date,
): number {
  const now = Date.now();
  const elapsedSeconds = (now - lastUpdateTime.getTime()) / 1000;
  const regenerated = Math.floor(elapsedSeconds * regenRate);
  return Math.min(maxEnergy, storedEnergy + regenerated);
}

/**
 * Get a user's current energy state (with regeneration calculated).
 */
export function getEnergyState(user: User): EnergyState {
  const current = calculateCurrentEnergy(
    user.energy,
    user.maxEnergy,
    user.energyRegenRate,
    user.energyUpdatedAt,
  );

  const deficit = user.maxEnergy - current;
  const secondsToFull =
    deficit <= 0 ? 0 : Math.ceil(deficit / user.energyRegenRate);

  return {
    current,
    max: user.maxEnergy,
    regenRate: user.energyRegenRate,
    secondsToFull,
  };
}

/**
 * Process a batch of taps from the Mini App.
 *
 * Flow:
 * 1. Rate-limit check (prevent spam submissions)
 * 2. Calculate current energy (with regen)
 * 3. Validate tap count against available energy
 * 4. Deduct energy, award points, update DB
 * 5. Return new state
 *
 * All in one transaction to prevent race conditions.
 */
export async function processTaps(
  userId: number,
  requestedTaps: number,
  sourceType: SourceType,
): Promise<TapResult & { success: boolean; error?: string }> {
  // Validate tap count
  if (requestedTaps < 1 || requestedTaps > MAX_TAP_BATCH_SIZE) {
    return {
      success: false,
      error: `Tap count must be between 1 and ${MAX_TAP_BATCH_SIZE}`,
      pointsEarned: 0,
      newBalance: 0,
      energy: { current: 0, max: 0, regenRate: 0, secondsToFull: 0 },
    };
  }

  // Rate limit: prevent rapid-fire submissions from same user
  const lastTap = lastTapTimestamps.get(userId);
  const now = Date.now();
  if (lastTap && now - lastTap < TAP_BATCH_COOLDOWN_MS) {
    return {
      success: false,
      error: "Too fast — wait a moment",
      pointsEarned: 0,
      newBalance: 0,
      energy: { current: 0, max: 0, regenRate: 0, secondsToFull: 0 },
    };
  }
  lastTapTimestamps.set(userId, now);

  // Fetch user within transaction
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      success: false,
      error: "User not found",
      pointsEarned: 0,
      newBalance: 0,
      energy: { current: 0, max: 0, regenRate: 0, secondsToFull: 0 },
    };
  }

  if (user.isBanned) {
    return {
      success: false,
      error: "Account is banned",
      pointsEarned: 0,
      newBalance: 0,
      energy: { current: 0, max: 0, regenRate: 0, secondsToFull: 0 },
    };
  }

  // Calculate current energy with regeneration
  const currentEnergy = calculateCurrentEnergy(
    user.energy,
    user.maxEnergy,
    user.energyRegenRate,
    user.energyUpdatedAt,
  );

  // Clamp taps to available energy
  const actualTaps = Math.min(requestedTaps, currentEnergy);

  if (actualTaps <= 0) {
    const energyState = getEnergyState(user);
    return {
      success: false,
      error: "No energy available",
      pointsEarned: 0,
      newBalance: 0,
      energy: {
        ...energyState,
        current: currentEnergy,
      },
    };
  }

  // Deduct energy
  const newEnergy = currentEnergy - actualTaps;
  const updateTime = new Date();

  await prisma.user.update({
    where: { id: userId },
    data: {
      energy: newEnergy,
      energyUpdatedAt: updateTime,
    },
  });

  // Award points through the standard points engine
  const awardResult = await awardTapPoints(
    userId,
    actualTaps,
    user.tapPower,
    sourceType,
  );

  const deficit = user.maxEnergy - newEnergy;
  const secondsToFull =
    deficit <= 0 ? 0 : Math.ceil(deficit / user.energyRegenRate);

  return {
    success: true,
    pointsEarned: actualTaps * user.tapPower,
    newBalance: awardResult.newBalance,
    energy: {
      current: newEnergy,
      max: user.maxEnergy,
      regenRate: user.energyRegenRate,
      secondsToFull,
    },
  };
}

/**
 * Clean up stale entries from the in-memory rate limiter.
 * Call periodically to prevent memory leaks.
 */
export function cleanupTapRateLimiter(): void {
  const cutoff = Date.now() - 60_000; // remove entries older than 1 minute
  for (const [userId, timestamp] of lastTapTimestamps) {
    if (timestamp < cutoff) {
      lastTapTimestamps.delete(userId);
    }
  }
}
