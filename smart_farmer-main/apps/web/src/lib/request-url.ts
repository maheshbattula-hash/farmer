import type { NextRequest } from "next/server";

function getFallbackUrl(request: NextRequest): URL {
  try {
    return new URL(request.url);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getRequestOrigin(request: NextRequest): string {
  const fallback = getFallbackUrl(request);
  const protocol = request.headers.get("x-forwarded-proto") || fallback.protocol.replace(/:$/, "") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || fallback.host;
  return `${protocol}://${host}`;
}

export function buildAbsoluteUrl(request: NextRequest, pathname: string): URL {
  return new URL(pathname, `${getRequestOrigin(request)}/`);
}
