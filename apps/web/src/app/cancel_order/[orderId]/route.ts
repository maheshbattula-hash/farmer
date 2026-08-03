export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cancelOrderAction } from "@/server/customer";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return cancelOrderAction(request as any, orderId);
}
