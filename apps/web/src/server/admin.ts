import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";
import { redirectWithFlash } from "@/lib/http";
import { renderTemplate } from "@/lib/template";

import { authFailureRedirect, requireSession } from "@/server/session";
import { getString } from "@/server/utils";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function adminDashboardPage(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["admin"], "/admin/login");
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch("/api/orders/admin/dashboard/", { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status, "/admin/login");
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success) {
    return redirectWithFlash(request, "/admin/login", "error", String(data.message || "Unable to load admin dashboard"));
  }

  return renderTemplate(
    request,
    "admin_dashboard_v2.html",
    {
      users: asArray(data.users),
      crops: asArray(data.crops),
      orders: asArray(data.orders),
      total_farmers: Number(data.total_farmers || 0),
      total_crops: Number(data.total_crops || 0),
      total_orders: Number(data.total_orders || 0),
      total_revenue: Number(data.total_revenue || 0),
      category_counts: asArray(data.category_counts),
      revenue_trend: asArray(data.revenue_trend),
    },
    "admin_dashboard",
  );
}

export async function adminUpdateOrderAction(request: NextRequest, orderId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["admin"], "/admin/login");
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    `/api/orders/admin/orders/${orderId}/status/`,
    {
      method: "POST",
      body: {
        status: getString(formData, "status"),
      },
    },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, "/admin/login");
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/admin/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Order updated" : "Unable to update order")),
  );
}

export async function toggleVerificationAction(request: NextRequest, userId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["admin"], "/admin/login");
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(
    `/api/auth/admin/users/${userId}/toggle-verification/`,
    { method: "POST", body: {} },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, "/admin/login");
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/admin/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Farmer verification status updated!" : "Unable to update farmer verification")),
  );
}

export async function deleteUserAction(request: NextRequest, userId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["admin"], "/admin/login");
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(
    `/api/auth/admin/users/${userId}/`,
    { method: "DELETE" },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status, "/admin/login");
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/admin/dashboard",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "User deleted successfully" : "Unable to delete user")),
  );
}
