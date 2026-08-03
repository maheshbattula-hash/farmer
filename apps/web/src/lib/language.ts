import translations from "@/lib/translations.json";

export const DEFAULT_LANGUAGE = translations.DEFAULT_LANGUAGE;
export const LANGUAGE_OPTIONS = translations.LANGUAGE_OPTIONS as Array<[string, string]>;
export const TRANSLATIONS = translations.TRANSLATIONS as Record<string, Record<string, string>>;
export const SUPPORTED_LANGUAGE_CODES = new Set(LANGUAGE_OPTIONS.map(([code]) => code));
export const RUNTIME_TRANSLATION_LANGUAGES = new Set(["te", "ta", "hi", "kn", "ml"]);

export function normalizeLanguage(languageCode?: string | null): string {
  const normalized = (languageCode || DEFAULT_LANGUAGE).trim().toLowerCase();
  return SUPPORTED_LANGUAGE_CODES.has(normalized) ? normalized : DEFAULT_LANGUAGE;
}

export function isRuntimeTranslationLanguage(languageCode?: string | null): boolean {
  return RUNTIME_TRANSLATION_LANGUAGES.has(normalizeLanguage(languageCode));
}
