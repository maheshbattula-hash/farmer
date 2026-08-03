export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { deleteUserAction } from "@/server/admin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return deleteUserAction(request as any, id);
}
