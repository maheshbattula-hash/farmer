import type { NextRequest, NextResponse } from "next/server";

import { clearCookie, COOKIE_NAMES, readJsonCookie, setJsonCookie } from "@/lib/cookies";

export type FlashMessage = ["success" | "error" | "info" | "notice", string];

export function getFlashMessages(request: NextRequest): FlashMessage[] {
  return readJsonCookie<FlashMessage[]>(request, COOKIE_NAMES.flash) || [];
}

export function setFlash(response: NextResponse, category: FlashMessage[0], message: string): void {
  setJsonCookie(response, COOKIE_NAMES.flash, [[category, message]], { maxAge: 60 });
}

export function clearFlash(response: NextResponse): void {
  clearCookie(response, COOKIE_NAMES.flash);
}
