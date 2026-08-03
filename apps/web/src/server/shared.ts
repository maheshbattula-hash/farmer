import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { COOKIE_NAMES } from "@/lib/cookies";
import { getSessionState } from "@/lib/auth";
import { redirect, sanitizeNextUrl } from "@/lib/http";
import { normalizeLanguage } from "@/lib/language";

function getFallbackNextPath(request: NextRequest): string {
  const referer = request.headers.get("referer");
  if (!referer) {
    return "/";
  }
  try {
    const refererUrl = new URL(referer);
    return sanitizeNextUrl(`${refererUrl.pathname}${refererUrl.search}`);
  } catch {
    return "/";
  }
}

export async function home(request: NextRequest): Promise<NextResponse> {
  const session = getSessionState(request);
  if (session.user) {
    if (session.user.role === "farmer") {
      return redirect(request, "/farmer/dashboard");
    }
    if (session.user.role === "admin") {
      return redirect(request, "/admin/dashboard");
    }
    return redirect(request, "/marketplace");
  }
  return redirect(request, "/login");
}

export async function setLanguage(request: NextRequest): Promise<NextResponse> {
  let requestedLanguage: string | null = null;
  let nextPath: string | null = null;

  if (request.method === "GET") {
    requestedLanguage = request.nextUrl.searchParams.get("language");
    nextPath = request.nextUrl.searchParams.get("next");
  } else {
    const formData = await request.formData();
    requestedLanguage = typeof formData.get("language") === "string" ? String(formData.get("language")) : null;
    nextPath = typeof formData.get("next") === "string" ? String(formData.get("next")) : null;
  }

  const response = redirect(request, sanitizeNextUrl(nextPath) || getFallbackNextPath(request));
  response.cookies.set(COOKIE_NAMES.lang, normalizeLanguage(requestedLanguage), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
