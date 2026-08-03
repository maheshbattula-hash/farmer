export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { smartHubPage } from "@/server/smart";

export async function GET(request: Request) {
  return smartHubPage(request as any);
}
