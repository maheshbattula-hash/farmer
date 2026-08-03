export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { adminLoginAction, adminLoginPage } from "@/server/auth";

export async function GET(request: Request) {
  return adminLoginPage(request as any);
}
export async function POST(request: Request) {
  return adminLoginAction(request as any);
}
