export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { sendMessageAction } from "@/server/chat";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return sendMessageAction(request as any, id);
}
