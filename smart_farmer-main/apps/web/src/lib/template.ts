import path from "node:path";

import nunjucks from "nunjucks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionState } from "@/lib/auth";
import { OTP_EXPIRY_MINUTES, OTP_EXPIRY_SECONDS } from "@/lib/config";
import { getFlashMessages } from "@/lib/flash";
import { buildPath } from "@/lib/routes";
import translations from "@/lib/translations.json";

const DEFAULT_LANGUAGE = translations.DEFAULT_LANGUAGE;
const LANGUAGE_OPTIONS = translations.LANGUAGE_OPTIONS;
const TRANSLATIONS = translations.TRANSLATIONS as Record<string, Record<string, string>>;

const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  pending: "status.pending",
  Paid: "status.paid",
  "Order Confirmed": "status.order_confirmed",
  Packed: "status.packed",
  Shipped: "status.shipped",
  "Out for Delivery": "status.out_for_delivery",
  Delivered: "status.delivered",
  Cancelled: "status.cancelled",
  Completed: "status.completed",
  "Order Placed": "status.order_placed",
  Standard: "status.standard",
  Verified: "status.verified",
};

const ROLE_TRANSLATION_KEYS: Record<string, string> = {
  admin: "role.admin",
  farmer: "role.farmer",
  customer: "role.customer",
};

nunjucks.installJinjaCompat();

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.join(process.cwd(), "templates")),
  { autoescape: true, throwOnUndefined: false, noCache: true },
);

const safeJson = (value: unknown) => new nunjucks.runtime.SafeString(JSON.stringify(value));

env.addFilter("tojson", safeJson);
env.addFilter("list", (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return Array.from(value);
  }
  return Array.from(value as Iterable<unknown>);
});

type AttributeTest = "equalto" | "truthy" | "falsy";

function getAttrValue(item: unknown, attribute?: string | number) {
  if (typeof attribute === "number" && Array.isArray(item)) {
    return item[attribute];
  }
  if (typeof attribute === "string" && item && typeof item === "object") {
    return (item as Record<string, unknown>)[attribute];
  }
  return item;
}

function attributeMatches(value: unknown, test?: AttributeTest | string, expected?: unknown) {
  if (!test || test === "truthy") {
    return Boolean(value);
  }
  if (test === "falsy") {
    return !value;
  }
  if (test === "equalto") {
    return value === expected;
  }
  return Boolean(value);
}

env.addFilter("selectattr", (value, attribute?: string | number, test?: AttributeTest | string, expected?: unknown) => {
  const items = Array.isArray(value) ? value : [];
  return items.filter((item) => attributeMatches(getAttrValue(item, attribute), test, expected));
});

env.addFilter("rejectattr", (value, attribute?: string | number, test?: AttributeTest | string, expected?: unknown) => {
  const items = Array.isArray(value) ? value : [];
  if (!test) {
    return items.filter((item) => !Boolean(getAttrValue(item, attribute)));
  }
  return items.filter((item) => !attributeMatches(getAttrValue(item, attribute), test, expected));
});

env.addGlobal("range", (...args: number[]) => {
  let start = 0;
  let stop = 0;
  let step = 1;
  if (args.length === 1) {
    [stop] = args;
  } else if (args.length >= 2) {
    [start, stop] = args;
    if (args.length >= 3) {
      step = args[2];
    }
  }
  if (step === 0) {
    return [];
  }
  const result: number[] = [];
  if (step > 0) {
    for (let index = start; index < stop; index += step) {
      result.push(index);
    }
  } else {
    for (let index = start; index > stop; index += step) {
      result.push(index);
    }
  }
  return result;
});

env.addFilter("reverse", (value) => (Array.isArray(value) ? [...value].reverse() : value));
env.addFilter("map", (value, options?: { attribute?: string | number }) => {
  const items = Array.isArray(value) ? value : [];
  const attribute = options?.attribute;
  return items.map((item) => {
    if (typeof attribute === "number") {
      return (item as unknown[])[attribute];
    }
    if (typeof attribute === "string") {
      return (item as Record<string, unknown>)?.[attribute];
    }
    return item;
  });
});
env.addFilter("sum", (value, options?: { attribute?: string }) => {
  const items = Array.isArray(value) ? value : [];
  return items.reduce((total, item) => {
    if (!options?.attribute) {
      return total + Number(item || 0);
    }
    return total + Number((item as Record<string, unknown>)?.[options.attribute] || 0);
  }, 0);
});
env.addFilter("format", (pattern: string, value: unknown) => {
  if (typeof pattern !== "string") {
    return String(value ?? "");
  }
  const match = pattern.match(/^%\.([0-9]+)f$/);
  if (match) {
    return Number(value || 0).toFixed(Number.parseInt(match[1], 10));
  }
  if (pattern === "%s") {
    return String(value ?? "");
  }
  return pattern.replace("%s", String(value ?? ""));
});

function stripKeywordMarker<T extends Record<string, unknown>>(value: T | undefined): T {
  if (!value) {
    return {} as T;
  }
  const next = { ...value };
  delete (next as Record<string, unknown>).__keywords;
  return next;
}

function normalizeLanguage(languageCode?: string | null): string {
  const normalized = (languageCode || DEFAULT_LANGUAGE).trim().toLowerCase();
  return LANGUAGE_OPTIONS.some(([code]) => code === normalized) ? normalized : DEFAULT_LANGUAGE;
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return Object.entries(params).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value ?? "")), template);
}

function createTranslator(language: string) {
  return (key: string, defaultValue?: string, rawParams?: Record<string, unknown>) => {
    const params = stripKeywordMarker(rawParams);
    const catalog = TRANSLATIONS[language] || {};
    const template = catalog[key] || defaultValue || key;
    return interpolate(template, params);
  };
}

function createStatusTranslator(t: ReturnType<typeof createTranslator>) {
  return (value?: string) => (value ? t(STATUS_TRANSLATION_KEYS[value] || "", value) : value || "");
}

function createRoleTranslator(t: ReturnType<typeof createTranslator>) {
  return (value?: string) => (value ? t(ROLE_TRANSLATION_KEYS[value] || "", value.charAt(0).toUpperCase() + value.slice(1)) : value || "");
}

class SessionWrapper {
  user_id?: string;
  username?: string;
  email?: string;
  role?: string;
  has_visited?: boolean;
  lang?: string;

  constructor(values: Partial<SessionWrapper>) {
    Object.assign(this, values);
  }

  get(key: keyof SessionWrapper | string, defaultValue: unknown = "") {
    return (this as Record<string, unknown>)[key] ?? defaultValue;
  }
}

export function renderTemplate(
  request: NextRequest,
  templateName: string,
  context: Record<string, unknown>,
  endpoint: string,
  status = 200,
): NextResponse {
  const sessionState = getSessionState(request);
  const language = normalizeLanguage(sessionState.language);
  const t = createTranslator(language);
  const flashedMessages = getFlashMessages(request);
  const fullPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const html = env.render(templateName, {
    current_language: language,
    language_options: LANGUAGE_OPTIONS.map(([code, label]) => ({ code, label })),
    otp_expiry_seconds: OTP_EXPIRY_SECONDS,
    otp_expiry_minutes: OTP_EXPIRY_MINUTES,
    flashed_messages: flashedMessages,
    session: new SessionWrapper({
      user_id: sessionState.user?.id,
      username: sessionState.user?.username,
      email: sessionState.user?.email,
      role: sessionState.user?.role,
      has_visited: sessionState.hasVisited,
      lang: language,
    }),
    request: {
      endpoint,
      path: request.nextUrl.pathname,
      full_path: fullPath,
      query_string: request.nextUrl.search ? request.nextUrl.search.slice(1) : "",
    },
    t: (key: string, defaultValue?: string, rawParams?: Record<string, unknown>) =>
      t(key, defaultValue, rawParams),
    t_status: createStatusTranslator(t),
    t_role: createRoleTranslator(t),
    url_for: (routeName: string, rawKwargs?: Record<string, unknown>) => buildPath(routeName, stripKeywordMarker(rawKwargs), request),
    ...context,
  });

  const response = new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
  response.cookies.delete("sf_flash");
  return response;
}
