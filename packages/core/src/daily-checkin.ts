/**
 * Daily Check-in Engine
 *
 * Streak-based reward system:
 * Day 1: 50 pts, Day 2: 75, Day 3: 100, Day 4: 150,
 * Day 5: 200, Day 6: 300, Day 7+: 500
 * Miss a day → streak resets.
 */

import { prisma } from "@shen-zhen/database";
import { awardPoints } from "./points.js";

/** Points awarded per streak day */
const STREAK_REWARDS: Record<number, number> = {
  1: 50,
  2: 75,
  3: 100,
  4: 150,
  5: 200,
  6: 300,
  7: 500,
};

/** Get reward for a given streak day (caps at day 7 = 500) */
function getStreakReward(streak: number): number {
  if (streak >= 7) return 500;
  return STREAK_REWARDS[streak] ?? 50;
}

/** Today as a Date object with time set to 00:00:00 UTC */
function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Yesterday as a Date object */
function yesterdayUTC(): Date {
  const d = todayUTC();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export interface CheckinResult {
  success: boolean;
  alreadyCheckedIn?: boolean;
  streak: number;
  pointsAwarded: number;
  nextReward: number;
}

/**
 * Perform daily check-in for a user.
 * Returns the check-in result including streak info.
 */
export async function dailyCheckin(userId: number): Promise<CheckinResult> {
  const today = todayUTC();

  // Check if already checked in today
  const existing = await prisma.dailyCheckin.findUnique({
    where: { userId_day: { userId, day: today } },
  });

  if (existing) {
    return {
      success: false,
      alreadyCheckedIn: true,
      streak: existing.streak,
      pointsAwarded: 0,
      nextReward: getStreakReward(existing.streak + 1),
    };
  }

  // Check yesterday's check-in for streak
  const yesterday = yesterdayUTC();
  const yesterdayCheckin = await prisma.dailyCheckin.findUnique({
    where: { userId_day: { userId, day: yesterday } },
  });

  const streak = yesterdayCheckin ? yesterdayCheckin.streak + 1 : 1;
  const points = getStreakReward(streak);

  // Create check-in record
  await prisma.dailyCheckin.create({
    data: {
      userId,
      day: today,
      streak,
      pointsAwarded: points,
    },
  });

  // Award points through the ledger
  await awardPoints(userId, points, "daily_checkin", "bot", `checkin_${userId}_${today.toISOString().slice(0, 10)}`, { streak });

  return {
    success: true,
    streak,
    pointsAwarded: points,
    nextReward: getStreakReward(streak + 1),
  };
}

/**
 * Get check-in status for a user (streak, today's status, history).
 */
export async function getCheckinStatus(userId: number): Promise<{
  currentStreak: number;
  checkedInToday: boolean;
  todayReward: number;
  history: Array<{ day: Date; streak: number; pointsAwarded: number }>;
}> {
  const today = todayUTC();

  // Get last 30 check-ins
  const history = await prisma.dailyCheckin.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    take: 30,
    select: { day: true, streak: true, pointsAwarded: true },
  });

  const todayEntry = history.find(
    (h) => h.day.toISOString().slice(0, 10) === today.toISOString().slice(0, 10),
  );

  const checkedInToday = !!todayEntry;

  // Calculate current streak
  let currentStreak = 0;
  if (checkedInToday) {
    currentStreak = todayEntry.streak;
  } else {
    // Check if yesterday was checked in (streak still alive)
    const yesterday = yesterdayUTC();
    const yesterdayEntry = history.find(
      (h) => h.day.toISOString().slice(0, 10) === yesterday.toISOString().slice(0, 10),
    );
    if (yesterdayEntry) {
      currentStreak = yesterdayEntry.streak;
    }
  }

  return {
    currentStreak,
    checkedInToday,
    todayReward: checkedInToday ? 0 : getStreakReward(currentStreak + 1),
    history,
  };
}
