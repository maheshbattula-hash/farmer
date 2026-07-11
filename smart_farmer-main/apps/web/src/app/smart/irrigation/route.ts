export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { smartIrrigationAction } from "@/server/smart";

export async function POST(request: Request) {
  return smartIrrigationAction(request as any);
}
