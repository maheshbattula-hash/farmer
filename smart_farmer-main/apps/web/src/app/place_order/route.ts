export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { placeOrderAction } from "@/server/marketplace";

export async function POST(request: Request) {
  return placeOrderAction(request as any);
}
