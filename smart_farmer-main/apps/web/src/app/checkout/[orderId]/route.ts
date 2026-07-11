export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkoutPage } from "@/server/customer";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return checkoutPage(request as any, orderId);
}
