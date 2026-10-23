import { NextResponse } from "next/server";
import { cacheSize, clearCache } from "@/lib/cache";

export const GET = async () =>
  NextResponse.json({ sizeBytes: await cacheSize() });

// Clears only the .giffer-cache directory (poster frames + probe metadata).
// It never touches the watch or output folders.
export const DELETE = async () => {
  await clearCache();
  return NextResponse.json({ success: "Cache cleared", data: { sizeBytes: 0 } });
};
