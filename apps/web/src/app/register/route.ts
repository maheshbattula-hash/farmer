export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { registerAction, registerPage } from "@/server/auth";

export async function GET(request: Request) {
  return registerPage(request as any);
}
export async function POST(request: Request) {
  return registerAction(request as any);
}
