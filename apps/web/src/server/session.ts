import type { NextRequest, NextResponse } from "next/server";

import { getSessionState, type SessionState } from "@/lib/auth";
import { redirectWithFlash, unauthorizedRedirect } from "@/lib/http";

export function requireSession(
  request: NextRequest,
  roles?: Array<"admin" | "farmer" | "customer">,
  loginPath = "/login",
): SessionState | NextResponse {
  const session = getSessionState(request);
  if (!session.user || !session.token) {
    return unauthorizedRedirect(request, loginPath);
  }
  if (roles && !roles.includes(session.user.role)) {
    const redirectPath = roles.includes("admin") ? "/admin/login" : "/";
    return redirectWithFlash(request, redirectPath, "error", "Unauthorized access");
  }
  return session;
}

export function authFailureRedirect(
  request: NextRequest,
  statusCode: number,
  loginPath = "/login",
): NextResponse | null {
  if (statusCode === 401 || statusCode === 403) {
    return unauthorizedRedirect(request, loginPath);
  }
  return null;
}
