export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { confirmPaymentAction } from "@/server/customer";

export async function POST(request: Request) {
  return confirmPaymentAction(request as any);
}
