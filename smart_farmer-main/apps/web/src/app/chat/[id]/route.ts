export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { chatPage } from "@/server/chat";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return chatPage(request as any, id);
}
