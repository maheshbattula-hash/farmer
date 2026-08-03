export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { farmerDashboardPage } from "@/server/farmer";

export async function GET(request: Request) {
  return farmerDashboardPage(request as any);
}
