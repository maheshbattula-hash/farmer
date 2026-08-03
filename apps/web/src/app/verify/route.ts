export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { verifyAction, verifyPage } from "@/server/auth";

export async function GET(request: Request) {
  return verifyPage(request as any);
}
export async function POST(request: Request) {
  return verifyAction(request as any);
}
