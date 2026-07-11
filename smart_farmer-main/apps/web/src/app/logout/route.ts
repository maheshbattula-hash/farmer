export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { logoutAction } from "@/server/auth";

export async function GET(request: Request) {
  return logoutAction(request as any);
}
