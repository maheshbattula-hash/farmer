export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isRuntimeTranslationLanguage, normalizeLanguage } from "@/lib/language";

type TranslatePayload = {
  language?: unknown;
  texts?: unknown;
};

const GOOGLE_TRANSLATE_API_KEY =
  (process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY || "").trim();
const MAX_TEXTS = 48;
const MAX_TOTAL_CHARACTERS = 10_000;
const MAX_SINGLE_TEXT_LENGTH = 1_500;
const translationCache = new Map<string, string>();
const translationInflight = new Map<string, Promise<string>>();

function cacheKey(language: string, text: string): string {
  return `${language}::${text}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCodePoint(Number.parseInt(code, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      try {
        return String.fromCodePoint(Number.parseInt(code, 16));
      } catch {
        return _;
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sanitizeTranslatedValue(value: unknown, fallback: string): string {
  const translated = decodeHtmlEntities(String(value || "")).trim();
  return translated || fallback;
}

function normalizeInputText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function translateWithOfficialApi(texts: string[], language: string): Promise<string[]> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw new Error("official_api_key_missing");
  }

  const requestBody = new URLSearchParams();
  requestBody.set("key", GOOGLE_TRANSLATE_API_KEY);
  requestBody.set("source", "en");
  requestBody.set("target", language);
  requestBody.set("format", "text");
  texts.forEach((text) => requestBody.append("q", text));

  const response = await fetch("https://translation.googleapis.com/language/translate/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    cache: "no-store",
    body: requestBody.toString(),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`official_translate_failed:${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      translations?: Array<{ translatedText?: string }>;
    };
  };
  const translations = Array.isArray(payload.data?.translations) ? payload.data.translations : [];
  if (translations.length !== texts.length) {
    throw new Error("official_translate_payload_mismatch");
  }

  return translations.map((item, index) => sanitizeTranslatedValue(item?.translatedText, texts[index]));
}

async function translateWithGoogleGtx(text: string, language: string): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", language);
  url.searchParams.set("dt", "t");
  url.searchParams.set("dj", "1");
  url.searchParams.set("q", text);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`runtime_translate_failed:${response.status}`);
  }

  const payload = (await response.json()) as {
    sentences?: Array<{ trans?: string }>;
  };
  const translated = Array.isArray(payload.sentences)
    ? payload.sentences.map((item) => item?.trans || "").join("")
    : "";
  return sanitizeTranslatedValue(translated, text);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

async function translateSingleText(text: string, language: string): Promise<string> {
  const key = cacheKey(language, text);
  const cached = translationCache.get(key);
  if (cached) {
    return cached;
  }
  if (translationInflight.has(key)) {
    return translationInflight.get(key)!;
  }

  const task = (async () => {
    const translated = await translateWithGoogleGtx(text, language);
    translationCache.set(key, translated);
    if (translationCache.size > 5_000) {
      const oldestKey = translationCache.keys().next().value;
      if (oldestKey) {
        translationCache.delete(oldestKey);
      }
    }
    return translated;
  })().finally(() => {
    translationInflight.delete(key);
  });

  translationInflight.set(key, task);
  return task;
}

async function translateTexts(texts: string[], language: string): Promise<string[]> {
  const normalizedTexts = texts.map((text) => normalizeInputText(text));
  const results = normalizedTexts.slice();
  const missingTexts = Array.from(
    new Set(
      normalizedTexts.filter((text) => {
        if (!text || text.length > MAX_SINGLE_TEXT_LENGTH) {
          return false;
        }
        return !translationCache.has(cacheKey(language, text));
      }),
    ),
  );

  normalizedTexts.forEach((text, index) => {
    if (!text) {
      results[index] = "";
      return;
    }
    if (text.length > MAX_SINGLE_TEXT_LENGTH) {
      results[index] = text;
      return;
    }
    const cached = translationCache.get(cacheKey(language, text));
    if (cached) {
      results[index] = cached;
    }
  });

  if (missingTexts.length) {
    let translatedMissingTexts: string[];
    try {
      translatedMissingTexts = await translateWithOfficialApi(missingTexts, language);
      missingTexts.forEach((sourceText, index) => {
        translationCache.set(cacheKey(language, sourceText), translatedMissingTexts[index]);
      });
    } catch {
      translatedMissingTexts = await mapWithConcurrency(missingTexts, 4, (text) => translateSingleText(text, language));
    }

    const translatedLookup = new Map<string, string>();
    missingTexts.forEach((sourceText, index) => {
      const translated = sanitizeTranslatedValue(translatedMissingTexts[index], sourceText);
      translatedLookup.set(sourceText, translated);
      translationCache.set(cacheKey(language, sourceText), translated);
    });

    normalizedTexts.forEach((text, index) => {
      if (!text || text.length > MAX_SINGLE_TEXT_LENGTH) {
        return;
      }
      const cached = translationCache.get(cacheKey(language, text));
      results[index] = cached || translatedLookup.get(text) || text;
    });
  }

  return results;
}

export async function POST(request: Request) {
  let payload: TranslatePayload | null = null;
  try {
    payload = (await request.json()) as TranslatePayload;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid translation payload." }, { status: 400 });
  }

  const language = normalizeLanguage(typeof payload?.language === "string" ? payload.language : null);
  if (!isRuntimeTranslationLanguage(language)) {
    return NextResponse.json({ success: false, message: "Unsupported translation language." }, { status: 400 });
  }

  const texts = Array.isArray(payload?.texts) ? payload.texts.map((value) => String(value ?? "")) : [];
  if (!texts.length || texts.length > MAX_TEXTS) {
    return NextResponse.json({ success: false, message: "Too many translation entries." }, { status: 400 });
  }

  const totalCharacters = texts.reduce((count, text) => count + text.length, 0);
  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    return NextResponse.json({ success: false, message: "Translation request is too large." }, { status: 413 });
  }

  try {
    const translations = await translateTexts(texts, language);
    return NextResponse.json({ success: true, language, translations }, { status: 200 });
  } catch (error) {
    console.error("Smart Farmer runtime translation failed", error);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to translate content right now.",
        language,
        translations: texts,
      },
      { status: 502 },
    );
  }
}
