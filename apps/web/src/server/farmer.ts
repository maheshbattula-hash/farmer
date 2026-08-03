import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";
import { redirectWithFlash } from "@/lib/http";
import { renderTemplate } from "@/lib/template";

import { authFailureRedirect, requireSession } from "@/server/session";
import { copyFormData, getString } from "@/server/utils";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function farmerDashboardPage(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch("/api/marketplace/farmer/dashboard", { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success) {
    return redirectWithFlash(request, "/", "error", String(data.message || "Unable to load farmer dashboard"));
  }

  return renderTemplate(
    request,
    "farmer.html",
    {
      crops: asArray(data.crops),
      orders: asArray(data.orders),
      is_verified: Boolean(data.is_verified),
      metrics: asRecord(data.metrics),
      top_selling_crops: asArray(data.top_selling_crops),
      demand_hotspots: asArray(data.demand_hotspots),
      smart_alerts: asArray(data.smart_alerts),
    },
    "farmer_dashboard",
  );
}

export async function addCropAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = copyFormData(await request.formData());
  const { response, data } = await apiFetch(
    "/api/marketplace/farmer/crops",
    {
      method: "POST",
      body: formData,
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/farmer/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Crop added successfully!" : "Unable to add crop")),
  );
}

export async function editCropPage(request: NextRequest, cropId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(`/api/marketplace/farmer/crops/${cropId}`, { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success || !data.crop) {
    return redirectWithFlash(request, "/farmer/dashboard", "error", String(data.message || "Crop not found"));
  }
  return renderTemplate(request, "edit_crop.html", { crop: data.crop }, "edit_crop");
}

export async function editCropAction(request: NextRequest, cropId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = copyFormData(await request.formData());
  const { response, data } = await apiFetch(
    `/api/marketplace/farmer/crops/${cropId}`,
    {
      method: "PATCH",
      body: formData,
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/farmer/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Crop updated successfully!" : "Unable to update crop")),
  );
}

export async function deleteCropAction(request: NextRequest, cropId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(
    `/api/marketplace/farmer/crops/${cropId}`,
    { method: "DELETE" },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/farmer/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Crop deleted successfully" : "Unable to delete crop")),
  );
}

export async function updateOrderStatusAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["farmer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    "/api/orders/farmer/update-status",
    {
      method: "POST",
      body: {
        order_id: getString(formData, "order_id"),
        status: getString(formData, "status"),
        location: getString(formData, "location"),
        tracking_code: getString(formData, "tracking_code"),
      },
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/farmer/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Order updated" : "Unable to update order")),
  );
}
