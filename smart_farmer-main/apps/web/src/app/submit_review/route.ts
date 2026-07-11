export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { submitReviewAction } from "@/server/customer";

export async function POST(request: Request) {
  return submitReviewAction(request as any);
}
