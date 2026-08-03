export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requestPasswordResetOtpAction } from "@/server/auth";

export async function POST(request: Request) {
  return requestPasswordResetOtpAction(request as any);
}
