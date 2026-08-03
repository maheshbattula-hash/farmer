import type { NextRequest, NextResponse } from "next/server";

export const COOKIE_NAMES = {
  lang: "sf_lang",
  accessToken: "sf_access_token",
  user: "sf_user",
  preAuth: "sf_pre_auth",
  resetAuth: "sf_reset_auth",
  adminAuth: "sf_admin_auth",
  flash: "sf_flash",
  hasVisited: "sf_has_visited",
} as const;

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: "admin" | "farmer" | "customer";
  full_name?: string;
  is_verified?: boolean;
  preferred_language?: string;
};

export type PendingFlow = {
  challengeId: string;
  email: string;
  purpose: string;
  verified?: boolean;
};

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function readJsonCookie<T>(request: NextRequest, name: string): T | null {
  const cookie = request.cookies.get(name)?.value;
  if (!cookie) {
    return null;
  }
  return decodeJson<T>(cookie);
}

export function setJsonCookie(
  response: NextResponse,
  name: string,
  value: unknown,
  options: Partial<Parameters<NextResponse["cookies"]["set"]>[2]> = {},
): void {
  response.cookies.set(name, encodeJson(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    ...options,
  });
}

export function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", {
    path: "/",
    expires: new Date(0),
  });
}
