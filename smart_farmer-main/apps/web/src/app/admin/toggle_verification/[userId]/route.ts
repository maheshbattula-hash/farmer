export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { toggleVerificationAction } from "@/server/admin";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return toggleVerificationAction(request as any, userId);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return toggleVerificationAction(request as any, userId);
}
