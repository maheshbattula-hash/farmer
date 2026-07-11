import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clearAuth, getSessionState } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { buildAbsoluteUrl } from "@/lib/request-url";

function redirectStatus(request: NextRequest): 303 | 307 {
  return request.method === "GET" || request.method === "HEAD" ? 307 : 303;
}

export function redirect(request: NextRequest, pathname: string): NextResponse {
  return NextResponse.redirect(buildAbsoluteUrl(request, pathname), redirectStatus(request));
}

export function redirectWithFlash(
  request: NextRequest,
  pathname: string,
  category: "success" | "error" | "info" | "notice",
  message: string,
): NextResponse {
  const response = redirect(request, pathname);
  setFlash(response, category, message);
  return response;
}

export function unauthorizedRedirect(request: NextRequest, loginPath = "/login"): NextResponse {
  const response = redirect(request, loginPath);
  clearAuth(response);
  setFlash(response, "error", "Please login first");
  return response;
}

export function requireRole(request: NextRequest, roles?: Array<"admin" | "farmer" | "customer">) {
  const session = getSessionState(request);
  if (!session.user || !session.token) {
    return null;
  }
  if (roles && !roles.includes(session.user.role)) {
    return null;
  }
  return session;
}

export function sanitizeNextUrl(target: string | null | undefined): string {
  if (!target) {
    return "/";
  }
  const cleaned = target.trim();
  if (!cleaned.startsWith("/") || cleaned.startsWith("//")) {
    return "/";
  }
  return cleaned;
}
