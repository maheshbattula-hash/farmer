import type { NextRequest } from "next/server";

import { COOKIE_NAMES } from "@/lib/cookies";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGE_CODES, TRANSLATIONS } from "@/lib/language";

export function getRequestLanguage(request: NextRequest): string {
  const language = (request.cookies.get(COOKIE_NAMES.lang)?.value || DEFAULT_LANGUAGE).trim().toLowerCase();
  return SUPPORTED_LANGUAGE_CODES.has(language) ? language : DEFAULT_LANGUAGE;
}

export function tForRequest(request: NextRequest, key: string, fallback: string): string {
  const language = getRequestLanguage(request);
  return TRANSLATIONS[language]?.[key] || fallback;
}
