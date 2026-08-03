export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { startChatAction } from "@/server/chat";

export async function GET(
  request: Request,
  context: { params: Promise<{ cropId: string }> },
) {
  const { cropId } = await context.params;
  return startChatAction(request as any, cropId);
}
