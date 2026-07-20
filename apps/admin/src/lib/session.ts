/**
 * Shén Zhèn Admin — Session Configuration (iron-session)
 *
 * Uses encrypted, httpOnly cookies. No JWT, no tokens flying around.
 */

import { getIronSession, type SessionOptions, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  adminId?: number;
  username?: string;
  isLoggedIn: boolean;
}

const SESSION_OPTIONS: SessionOptions = {
  password: process.env["SESSION_SECRET"] ?? "this-is-a-dev-secret-must-be-32-chars-long-at-least!!",
  cookieName: "shen-zhen-admin",
  cookieOptions: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.adminId) {
    throw new Error("Unauthorized");
  }

  return {
    adminId: session.adminId,
    username: session.username,
    isLoggedIn: session.isLoggedIn,
  };
}
