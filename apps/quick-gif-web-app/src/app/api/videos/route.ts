import { promises as fs } from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { isVideo, resolveInDir } from "@/lib/ffmpeg";
import type { VideoMeta } from "@/lib/types";

// Fast listing: just readdir + stat (no ffprobe — the editor probes a single
// video on demand when you open it, so the library appears instantly).
export const GET = async () => {
  const settings = await loadSettings();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(settings.watchDir);
  } catch {
    return NextResponse.json({ videos: [], watchDir: settings.watchDir });
  }
  const videos: VideoMeta[] = [];
  for (const entry of entries.filter(isVideo).sort()) {
    try {
      const stat = await fs.stat(path.join(settings.watchDir, entry));
      videos.push({
        name: entry,
        width: 0,
        height: 0,
        duration: 0,
        fps: 0,
        sizeBytes: stat.size,
        modifiedAt: stat.mtimeMs,
      });
    } catch {
      // skip unreadable
    }
  }
  return NextResponse.json({ videos, watchDir: settings.watchDir });
};

export const DELETE = async (request: NextRequest) => {
  const name = request.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const settings = await loadSettings();
  let filePath: string;
  try {
    filePath = resolveInDir(settings.watchDir, name);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await fs.rm(filePath);
    return NextResponse.json({ success: "Deleted" });
  } catch {
    return NextResponse.json({ error: "Could not delete file" }, { status: 500 });
  }
};
