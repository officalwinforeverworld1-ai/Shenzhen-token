/**
 * Shén Zhèn Airdrop — Database Package Exports
 *
 * Re-exports everything consumers need:
 * - Prisma client singleton
 * - All generated Prisma types
 */

export { prisma } from "./client.js";
export { PrismaClient, Prisma } from "@prisma/client";
export type {
  User,
  PointLedger,
  Task,
  TaskSubmission,
  Referral,
  SybilFlag,
  AdminUser,
  Upgrade,
  UserUpgrade,
  Broadcast,
} from "@prisma/client";
