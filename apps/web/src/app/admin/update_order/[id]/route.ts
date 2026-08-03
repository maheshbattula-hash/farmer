export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { adminUpdateOrderAction } from "@/server/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return adminUpdateOrderAction(request as any, id);
}
