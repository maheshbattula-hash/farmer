import type { NextRequest, NextResponse } from "next/server";

import { clearCookie, COOKIE_NAMES, PendingFlow, readJsonCookie, SessionUser, setJsonCookie } from "@/lib/cookies";

export type SessionState = {
  token: string | null;
  user: SessionUser | null;
  preAuth: PendingFlow | null;
  resetAuth: PendingFlow | null;
  adminAuth: PendingFlow | null;
  hasVisited: boolean;
  language: string;
};

export function getSessionState(request: NextRequest): SessionState {
  return {
    token: request.cookies.get(COOKIE_NAMES.accessToken)?.value || null,
    user: readJsonCookie<SessionUser>(request, COOKIE_NAMES.user),
    preAuth: readJsonCookie<PendingFlow>(request, COOKIE_NAMES.preAuth),
    resetAuth: readJsonCookie<PendingFlow>(request, COOKIE_NAMES.resetAuth),
    adminAuth: readJsonCookie<PendingFlow>(request, COOKIE_NAMES.adminAuth),
    hasVisited: request.cookies.get(COOKIE_NAMES.hasVisited)?.value === "1",
    language: request.cookies.get(COOKIE_NAMES.lang)?.value || "en",
  };
}

export function persistAuth(response: NextResponse, token: string, user: SessionUser): void {
  response.cookies.set(COOKIE_NAMES.accessToken, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  setJsonCookie(response, COOKIE_NAMES.user, user, { maxAge: 60 * 60 * 24 * 7 });
  response.cookies.set(COOKIE_NAMES.hasVisited, "1", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export function setPreAuth(response: NextResponse, flow: PendingFlow): void {
  setJsonCookie(response, COOKIE_NAMES.preAuth, flow, { maxAge: 60 * 30 });
}

export function clearPreAuth(response: NextResponse): void {
  clearCookie(response, COOKIE_NAMES.preAuth);
}

export function setResetAuth(response: NextResponse, flow: PendingFlow): void {
  setJsonCookie(response, COOKIE_NAMES.resetAuth, flow, { maxAge: 60 * 30 });
}

export function clearResetAuth(response: NextResponse): void {
  clearCookie(response, COOKIE_NAMES.resetAuth);
}

export function setAdminAuth(response: NextResponse, flow: PendingFlow): void {
  setJsonCookie(response, COOKIE_NAMES.adminAuth, flow, { maxAge: 60 * 30 });
}

export function clearAdminAuth(response: NextResponse): void {
  clearCookie(response, COOKIE_NAMES.adminAuth);
}

export function clearAuth(response: NextResponse): void {
  clearCookie(response, COOKIE_NAMES.accessToken);
  clearCookie(response, COOKIE_NAMES.user);
  clearPreAuth(response);
  clearResetAuth(response);
  clearAdminAuth(response);
}

export type { SessionUser, PendingFlow };
