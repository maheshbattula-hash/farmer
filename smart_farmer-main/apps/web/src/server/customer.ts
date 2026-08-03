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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function myOrdersPage(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch("/api/orders/my", { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success) {
    return redirectWithFlash(request, "/marketplace", "error", String(data.message || "Unable to load orders"));
  }

  return renderTemplate(
    request,
    "customer_orders.html",
    {
      active_orders: asArray(data.active_orders),
      order_history: asArray(data.order_history),
      summary: asRecord(data.summary),
    },
    "my_orders",
  );
}

export async function cancelOrderAction(request: NextRequest, orderId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(
    `/api/orders/${orderId}/cancel`,
    { method: "POST", body: {} },
    sessionOrResponse.token,
  );
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  return redirectWithFlash(
    request,
    "/my_orders",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Order updated" : "Unable to cancel order")),
  );
}

export async function checkoutPage(request: NextRequest, orderId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(`/api/orders/${orderId}`, { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status);
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success || !data.order) {
    return redirectWithFlash(request, "/my_orders", "error", String(data.message || "Order not found"));
  }

  return renderTemplate(request, "checkout.html", { order: data.order, payment_gateway: data.payment_gateway || {} }, "checkout");
}

export async function confirmPaymentAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    "/api/orders/confirm-payment",
    {
      method: "POST",
      body: {
        order_id: getString(formData, "order_id"),
        payment_method: getString(formData, "payment_method") || "UPI",
        payment_provider: getString(formData, "payment_provider") || "PhonePe",
        payment_reference: getString(formData, "payment_reference") || `WEB-${Date.now()}`,
        upi_id: getString(formData, "upi_id"),
        card_name: getString(formData, "card_name"),
        card_number: getString(formData, "card_number"),
        card_expiry: getString(formData, "card_expiry"),
        card_cvv: getString(formData, "card_cvv"),
        bank_name: getString(formData, "bank_name"),
        account_holder: getString(formData, "account_holder"),
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
    "/my_orders",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Payment successful" : "Unable to confirm payment")),
  );
}

export async function invoicePage(request: NextRequest, orderId: string): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer", "farmer", "admin"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const { response, data } = await apiFetch(`/api/orders/${orderId}/invoice`, { method: "GET" }, sessionOrResponse.token);
  const authRedirect = authFailureRedirect(request, response.status, sessionOrResponse.user?.role === "admin" ? "/admin/login" : "/login");
  if (authRedirect) {
    return authRedirect;
  }
  if (!response.ok || !data.success || !data.invoice) {
    return redirectWithFlash(request, "/my_orders", "error", String(data.message || "Invoice not available"));
  }

  return renderTemplate(
    request,
    "invoice.html",
    { invoice: data.invoice, order: data.order || {} },
    "invoice",
  );
}

export async function submitReviewAction(request: NextRequest): Promise<NextResponse> {
  const sessionOrResponse = requireSession(request, ["customer"]);
  if (sessionOrResponse instanceof NextResponse) {
    return sessionOrResponse;
  }

  const formData = await request.formData();
  const { response, data } = await apiFetch(
    "/api/reviews/submit",
    {
      method: "POST",
      body: {
        order_id: getString(formData, "order_id"),
        farmer_id: getString(formData, "farmer_id"),
        rating: getString(formData, "rating"),
        comment: getString(formData, "comment"),
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
    "/my_orders",
    response.ok && data.success ? "success" : "error",
    String(data.message || (response.ok ? "Review submitted" : "Unable to submit review")),
  );
}
