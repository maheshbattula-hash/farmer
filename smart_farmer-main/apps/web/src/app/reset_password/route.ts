export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { resetPasswordAction, resetPasswordPage } from "@/server/auth";

export async function GET(request: Request) {
  return resetPasswordPage(request as any);
}
export async function POST(request: Request) {
  return resetPasswordAction(request as any);
}
