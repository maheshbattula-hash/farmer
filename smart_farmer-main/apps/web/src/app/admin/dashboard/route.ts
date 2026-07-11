export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { adminDashboardPage } from "@/server/admin";

export async function GET(request: Request) {
  return adminDashboardPage(request as any);
}
