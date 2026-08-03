export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { marketplacePage } from "@/server/marketplace";

export async function GET(request: Request) {
  return marketplacePage(request as any);
}
