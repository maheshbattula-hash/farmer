export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { setLanguage } from "@/server/shared";

export async function GET(request: Request) {
  return setLanguage(request as any);
}
export async function POST(request: Request) {
  return setLanguage(request as any);
}
