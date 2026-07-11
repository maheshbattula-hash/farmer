export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { invoicePage } from "@/server/customer";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return invoicePage(request as any, orderId);
}
