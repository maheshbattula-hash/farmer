export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const candidatePaths = [
    path.join(process.cwd(), "public", "downloads", "smart-farmer.apk"),
    path.join(process.cwd(), "public", "static", "downloads", "smart-farmer.apk"),
    path.join(process.cwd(), "..", "mobile", "public", "downloads", "smart-farmer.apk"),
    path.join(process.cwd(), "..", "mobile", ".apk_build", "smart-farmer.apk"),
  ];

  let apkPath: string | null = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      apkPath = candidate;
      break;
    }
  }

  if (!apkPath) {
    return new NextResponse("Smart Farmer APK file not found.", { status: 404 });
  }

  const stat = fs.statSync(apkPath);
  const fileBuffer = fs.readFileSync(apkPath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="smart-farmer.apk"',
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
