export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { updateOrderStatusAction } from "@/server/farmer";

export async function POST(request: Request) {
  return updateOrderStatusAction(request as any);
}
