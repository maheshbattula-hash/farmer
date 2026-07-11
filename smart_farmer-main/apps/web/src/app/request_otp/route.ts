export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requestOtpAction } from "@/server/auth";

export async function POST(request: Request) {
  return requestOtpAction(request as any);
}
