/**
 * Shén Zhèn Airdrop — Auth Middleware
 *
 * Validates Telegram Mini App initData and issues JWT tokens.
 * initData validation uses HMAC-SHA256 as per Telegram's spec.
 */

import { createHmac } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "@shen-zhen/database";
import { INIT_DATA_MAX_AGE_SECONDS } from "@shen-zhen/shared";
import type { FastifyRequest, FastifyReply } from "fastify";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-jwt-secret-change-me";
const JWT_EXPIRY = process.env["JWT_EXPIRY"] ?? "24h";
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";

export interface AuthUser {
  userId: number;
  telegramId: bigint;
}

/**
 * Validate Telegram Mini App initData.
 * Returns parsed user data if valid, null if invalid.
 */
export function validateInitData(
  initDataRaw: string,
): { telegramId: number; username?: string; firstName: string; lastName?: string; authDate: number } | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get("hash");
    if (!hash) return null;

    // Remove hash from params and sort
    params.delete("hash");
    const entries = [...params.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

    // Create secret key: HMAC-SHA256("WebAppData", bot_token)
    const secretKey = createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    // Create hash: HMAC-SHA256(secret_key, data_check_string)
    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Compare hashes
    if (computedHash !== hash) return null;

    // Check auth_date freshness (prevent replay attacks)
    const authDate = parseInt(params.get("auth_date") ?? "0", 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > INIT_DATA_MAX_AGE_SECONDS) return null;

    // Parse user data
    const userStr = params.get("user");
    if (!userStr) return null;

    const user = JSON.parse(userStr) as {
      id: number;
      username?: string;
      first_name: string;
      last_name?: string;
    };

    return {
      telegramId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      authDate,
    };
  } catch {
    return null;
  }
}

/**
 * Issue a JWT token for a validated user.
 */
export function issueToken(userId: number, telegramId: bigint): string {
  return jwt.sign(
    { userId, telegramId: telegramId.toString() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY as jwt.SignOptions["expiresIn"] },
  );
}

/**
 * Verify a JWT token and return the user info.
 */
export function verifyToken(
  token: string,
): { userId: number; telegramId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      telegramId: string;
    };
    return payload;
  } catch {
    return null;
  }
}

/**
 * Fastify preHandler that validates the JWT from Authorization header.
 * Attaches the user to the request.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ success: false, error: "Missing authorization" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    reply.code(401).send({ success: false, error: "Invalid or expired token" });
    return;
  }

  // Verify user exists and isn't banned
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.isBanned) {
    reply.code(403).send({ success: false, error: "Account not found or banned" });
    return;
  }

  // Attach to request for route handlers
  (request as FastifyRequest & { authUser: AuthUser }).authUser = {
    userId: user.id,
    telegramId: user.telegramId,
  };
}
