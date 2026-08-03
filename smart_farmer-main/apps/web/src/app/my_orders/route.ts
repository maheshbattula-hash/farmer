export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { myOrdersPage } from "@/server/customer";

export async function GET(request: Request) {
  return myOrdersPage(request as any);
}
