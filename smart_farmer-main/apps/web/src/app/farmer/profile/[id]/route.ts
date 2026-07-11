export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { farmerProfilePage } from "@/server/marketplace";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return farmerProfilePage(request as any, id);
}
