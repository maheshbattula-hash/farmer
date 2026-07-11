export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { forgotPasswordAction, forgotPasswordPage } from "@/server/auth";

export async function GET(request: Request) {
  return forgotPasswordPage(request as any);
}
export async function POST(request: Request) {
  return forgotPasswordAction(request as any);
}
