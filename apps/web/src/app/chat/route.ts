export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { chatPage } from "@/server/chat";

export async function GET(request: Request) {
  return chatPage(request as any);
}
