export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { resetVerifyAction, resetVerifyPage } from "@/server/auth";

export async function GET(request: Request) {
  return resetVerifyPage(request as any);
}
export async function POST(request: Request) {
  return resetVerifyAction(request as any);
}
