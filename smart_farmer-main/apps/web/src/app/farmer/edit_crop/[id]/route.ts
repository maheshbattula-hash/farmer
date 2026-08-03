export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { editCropAction, editCropPage } from "@/server/farmer";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return editCropPage(request as any, id);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return editCropAction(request as any, id);
}
