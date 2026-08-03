export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { addCropAction } from "@/server/farmer";

export async function POST(request: Request) {
  return addCropAction(request as any);
}
