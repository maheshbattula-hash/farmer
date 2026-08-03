import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function jsonResponse(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

export function copyFormData(formData: FormData): FormData {
  const next = new FormData();
  formData.forEach((value, key) => {
    next.append(key, value);
  });
  return next;
}

export function buildQueryString(request: NextRequest): string {
  return request.nextUrl.search ? request.nextUrl.search : "";
}
