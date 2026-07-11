import type { NextRequest } from "next/server";

import { resolveMediaBaseUrl } from "@/lib/config";

function cleanKwargs(kwargs: Record<string, unknown> = {}) {
  const next = { ...kwargs };
  delete (next as Record<string, unknown>).__keywords;
  return next;
}

export function buildPath(
  endpoint: string,
  rawKwargs: Record<string, unknown> = {},
  request?: NextRequest,
): string {
  const kwargs = cleanKwargs(rawKwargs);
  switch (endpoint) {
    case "index":
      return "/";
    case "set_language":
      return "/set_language";
    case "marketplace":
      return "/marketplace";
    case "smart_hub":
      return "/smart";
    case "smart_disease":
      return "/smart/disease";
    case "smart_irrigation":
      return "/smart/irrigation";
    case "smart_location":
      return "/smart/location";
    case "chat":
      return "/chat";
    case "chat_thread":
      return `/chat/${kwargs.id}`;
    case "chat_start":
      return `/chat/start/${kwargs.crop_id}`;
    case "chat_send":
      return `/chat/${kwargs.id}/send`;
    case "request_otp":
      return "/request_otp";
    case "login":
      return "/login";
    case "verify":
      return "/verify";
    case "register":
      return "/register";
    case "forgot_password":
      return "/forgot_password";
    case "request_password_reset_otp":
      return "/request_password_reset_otp";
    case "verify_reset_otp":
      return "/reset_password/verify";
    case "reset_password":
      return "/reset_password";
    case "logout":
      return "/logout";
    case "farmer_dashboard":
      return "/farmer/dashboard";
    case "farmer_update_order":
      return "/farmer/update_order_status";
    case "add_crop":
      return "/farmer/add_crop";
    case "edit_crop":
      return `/farmer/edit_crop/${kwargs.id}`;
    case "delete_crop":
      return `/farmer/delete_crop/${kwargs.id}`;
    case "farmer_profile":
      return `/farmer/profile/${kwargs.id}`;
    case "submit_review":
      return "/submit_review";
    case "place_order":
      return "/place_order";
    case "my_orders":
      return "/my_orders";
    case "cancel_order":
      return `/cancel_order/${kwargs.order_id}`;
    case "checkout":
      return `/checkout/${kwargs.order_id}`;
    case "confirm_payment":
      return "/confirm_payment";
    case "invoice":
      return `/invoice/${kwargs.order_id}`;
    case "admin_login":
      return "/admin/login";
    case "admin_dashboard":
      return "/admin/dashboard";
    case "admin_update_order":
      return `/admin/update_order/${kwargs.id}`;
    case "toggle_verification":
      return `/admin/toggle_verification/${kwargs.user_id}`;
    case "delete_user":
      return `/admin/delete_user/${kwargs.id}`;
    case "static": {
      const filename = String(kwargs.filename || "").replace(/^\/+/, "");
      if (filename.startsWith("uploads/")) {
        return `${resolveMediaBaseUrl(request)}/${filename}`;
      }
      return `/static/${filename}`;
    }
    default:
      return "/";
  }
}
