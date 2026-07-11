export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { loginAction, loginPage } from "@/server/auth";

export async function GET(request: Request) {
  return loginPage(request as any);
}
export async function POST(request: Request) {
  return loginAction(request as any);
}
