export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { smartDiseaseAction } from "@/server/smart";

export async function POST(request: Request) {
  return smartDiseaseAction(request as any);
}
