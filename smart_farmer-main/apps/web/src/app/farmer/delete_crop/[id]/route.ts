export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { deleteCropAction } from "@/server/farmer";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return deleteCropAction(request as any, id);
}
