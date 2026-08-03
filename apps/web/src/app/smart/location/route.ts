export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { smartLocationAction } from "@/server/smart";

export async function POST(request: Request) {
  return smartLocationAction(request as any);
}
