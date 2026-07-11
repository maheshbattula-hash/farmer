import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";
import { COOKIE_NAMES } from "@/lib/cookies";
import { redirectWithFlash } from "@/lib/http";
import { normalizeLanguage } from "@/lib/language";
import { renderTemplate } from "@/lib/template";

import { authFailureRedirect, requireSession } from "@/server/session";
import { copyFormData, getString } from "@/server/utils";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function smartHubPage(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer", "admin"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch("/api/smart/overview", { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status, sessionOrResponse.user?.role === "admin" ? "/admin/login" : "/login");
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success) {
    return redirectWithFlash(request, "/marketplace", "error", String(data.message || "Unable to load Smart Hub"));
  }

  return renderTemplate(
    request,
    "smart_hub.html",
    {
      role: String(data.role || sessionOrResponse.user?.role || "customer"),
      analytics: asRecord(data.analytics),
      market_forecast: asArray(data.market_forecast),
      notifications: asArray(data.notifications),
      advisories: asArray(data.advisories),
      disease_reports: asArray(data.disease_reports),
      irrigation_plans: asArray(data.irrigation_plans),
      nearby_buyers: asArray(data.nearby_buyers),
    },
    "smart_hub",
  );
}

export async function smartDiseaseAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer", "admin"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = copyFormData(await request.formData());
  const { response, data } = await apiFetch(
    "/api/smart/disease/predict",
    {
      method: "POST",
      body: formData,
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, sessionOrResponse.user?.role === "admin" ? "/admin/login" : "/login");
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/smart",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Disease prediction ready" : "Unable to predict disease")),
  );
}

export async function smartIrrigationAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer", "admin"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    "/api/smart/irrigation/recommend",
    {
      method: "POST",
      body: {
        crop_name: getString(formData, "crop_name"),
        soil_moisture: getString(formData, "soil_moisture"),
        rainfall_mm: getString(formData, "rainfall_mm"),
        temperature_c: getString(formData, "temperature_c"),
      },
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, sessionOrResponse.user?.role === "admin" ? "/admin/login" : "/login");
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/smart",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Irrigation plan ready" : "Unable to generate irrigation plan")),
  );
}

export async function smartLocationAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer", "admin"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    "/api/smart/location",
    {
      method: "POST",
      body: {
        city: getString(formData, "city"),
        district: getString(formData, "district"),
        state: getString(formData, "state"),
        pincode: getString(formData, "pincode"),
        latitude: getString(formData, "latitude"),
        longitude: getString(formData, "longitude"),
        preferred_language: getString(formData, "preferred_language"),
        voice_enabled: getString(formData, "voice_enabled") === "on",
      },
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, sessionOrResponse.user?.role === "admin" ? "/admin/login" : "/login");
  if (authRedirect) {
    return authRedirect;
  }
  const next = redirectWithFlash(
    request,
    "/smart",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Preferences updated" : "Unable to update preferences")),
  );
  if (response.ok && data.success) {
    const preferredLanguage = normalizeLanguage(
      String((data.user && (data.user as Record<string, unknown>).preferred_language) || getString(formData, "preferred_language") || ""),
    );
    next.cookies.set(COOKIE_NAMES.lang, preferredLanguage, {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return next;
}
