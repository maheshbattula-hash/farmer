import type { NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/request-url";

export const API_URL = process.env.NEXT_API_URL || "http://localhost:8000";
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const OTP_EXPIRY_SECONDS = Number.parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10);
export const OTP_EXPIRY_MINUTES = Math.max(Math.floor(OTP_EXPIRY_SECONDS / 60), 1);

function inferApiPort(): string {
  try {
    const url = new URL(API_URL);
    if (url.port) {
      return url.port;
    }
    return url.protocol === "https:" ? "443" : "80";
  } catch {
    return "8000";
  }
}

function buildUrlFromRequest(request: NextRequest): string {
  const requestOrigin = getRequestOrigin(request);
  const originUrl = new URL(requestOrigin);
  const apiPort = inferApiPort();
  const portSegment = apiPort === "80" || apiPort === "443" ? "" : `:${apiPort}`;
  return `${originUrl.protocol}//${originUrl.hostname}${portSegment}`;
}

export function resolveMediaBaseUrl(request?: NextRequest): string {
  const explicitMediaUrl = (process.env.NEXT_MEDIA_URL || "").trim().replace(/\/$/, "");
  if (explicitMediaUrl) {
    return explicitMediaUrl;
  }
  if (request) {
    return `${buildUrlFromRequest(request)}/media`;
  }
  return `${PUBLIC_API_URL.replace(/\/$/, "")}/media`;
}
