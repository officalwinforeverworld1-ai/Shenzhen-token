/**
 * Spin the Wheel Engine
 *
 * 8-slice wheel with weighted probabilities.
 * 1 free spin every 8 hours, or pay 50 points for extra spin.
 * Prizes: 10, 25, 50, 100, 250, 500, 1000, 5000 (JACKPOT)
 */

import { prisma } from "@shen-zhen/database";
import { awardPoints, getBalance, spendPoints } from "./points.js";

/** Wheel slices — index matters for the animation */
export const WHEEL_SLICES = [
  { label: "10",       points: 10,   color: "#2d3436", weight: 30 },
  { label: "25",       points: 25,   color: "#00b894", weight: 25 },
  { label: "50",       points: 50,   color: "#0984e3", weight: 18 },
  { label: "100",      points: 100,  color: "#6c5ce7", weight: 12 },
  { label: "250",      points: 250,  color: "#fdcb6e", weight: 8  },
  { label: "500",      points: 500,  color: "#e17055", weight: 4  },
  { label: "1000",     points: 1000, color: "#d63031", weight: 2  },
  { label: "JACKPOT",  points: 5000, color: "#ffd700", weight: 1  },
] as const;

const FREE_SPIN_COOLDOWN_MS = 8 * 60 * 60 * 1000; // 8 hours
const PAID_SPIN_COST = 50;

/** Pick a random slice using weighted probability */
function pickSlice(): number {
  const totalWeight = WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < WHEEL_SLICES.length; i++) {
    roll -= WHEEL_SLICES[i]!.weight;
    if (roll <= 0) return i;
  }

  return 0; // fallback
}

export interface SpinResult {
  success: boolean;
  error?: string;
  prizeIndex?: number;
  pointsWon?: number;
  label?: string;
  nextFreeSpinAt?: Date;
}

export interface SpinStatus {
  canFreeSpin: boolean;
  nextFreeSpinAt: Date | null;
  totalSpins: number;
  totalWon: number;
  recentSpins: Array<{ pointsWon: number; spinType: string; createdAt: Date }>;
}

/**
 * Get spin status — can they spin? When's next free spin?
 */
export async function getSpinStatus(userId: number): Promise<SpinStatus> {
  const lastFreeSpin = await prisma.spinHistory.findFirst({
    where: { userId, spinType: "free" },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  let canFreeSpin = true;
  let nextFreeSpinAt: Date | null = null;

  if (lastFreeSpin) {
    const cooldownEnd = new Date(lastFreeSpin.createdAt.getTime() + FREE_SPIN_COOLDOWN_MS);
    if (now < cooldownEnd) {
      canFreeSpin = false;
      nextFreeSpinAt = cooldownEnd;
    }
  }

  // Get stats
  const [totalSpins, totalWon, recentSpins] = await Promise.all([
    prisma.spinHistory.count({ where: { userId } }),
    prisma.spinHistory.aggregate({
      where: { userId },
      _sum: { pointsWon: true },
    }),
    prisma.spinHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { pointsWon: true, spinType: true, createdAt: true },
    }),
  ]);

  return {
    canFreeSpin,
    nextFreeSpinAt,
    totalSpins,
    totalWon: totalWon._sum.pointsWon ?? 0,
    recentSpins,
  };
}

/**
 * Execute a spin — free or paid.
 */
export async function executeSpin(
  userId: number,
  type: "free" | "paid" = "free",
): Promise<SpinResult> {
  // Check cooldown for free spins
  if (type === "free") {
    const lastFreeSpin = await prisma.spinHistory.findFirst({
      where: { userId, spinType: "free" },
      orderBy: { createdAt: "desc" },
    });

    if (lastFreeSpin) {
      const cooldownEnd = new Date(lastFreeSpin.createdAt.getTime() + FREE_SPIN_COOLDOWN_MS);
      if (new Date() < cooldownEnd) {
        return {
          success: false,
          error: "Free spin not available yet",
          nextFreeSpinAt: cooldownEnd,
        };
      }
    }
  }

  // For paid spins, check and deduct balance
  if (type === "paid") {
    const balance = await getBalance(userId);
    if (balance < PAID_SPIN_COST) {
      return {
        success: false,
        error: `Need ${PAID_SPIN_COST} points for a paid spin (you have ${balance})`,
      };
    }

    await spendPoints(userId, PAID_SPIN_COST, "spin_purchase", "bot", `paid_spin_${Date.now()}`);
  }

  // Pick the prize
  const prizeIndex = pickSlice();
  const prize = WHEEL_SLICES[prizeIndex]!;

  // Record the spin
  await prisma.spinHistory.create({
    data: {
      userId,
      prizeIndex,
      pointsWon: prize.points,
      spinType: type,
    },
  });

  // Award the prize
  await awardPoints(userId, prize.points, "spin_reward", "bot", `spin_${Date.now()}`, { prizeIndex, label: prize.label, spinType: type });

  // Calculate next free spin time
  const nextFreeSpinAt = type === "free"
    ? new Date(Date.now() + FREE_SPIN_COOLDOWN_MS)
    : undefined;

  return {
    success: true,
    prizeIndex,
    pointsWon: prize.points,
    label: prize.label,
    nextFreeSpinAt: nextFreeSpinAt ?? undefined,
  };
}
