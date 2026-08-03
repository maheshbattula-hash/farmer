export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { home } from "@/server/shared";

export async function GET(request: Request) {
  return home(request as any);
}
