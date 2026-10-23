import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/config";
import { OUTPUT_EXTENSIONS } from "@/lib/ffmpeg";
import type { OutputMeta } from "@/lib/types";

export const GET = async () => {
  const settings = await loadSettings();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(settings.outputDir);
  } catch {
    return NextResponse.json({ outputs: [], outputDir: settings.outputDir });
  }
  const outputs: OutputMeta[] = [];
  for (const entry of entries) {
    if (!OUTPUT_EXTENSIONS.includes(path.extname(entry).toLowerCase())) continue;
    try {
      const stat = await fs.stat(path.join(settings.outputDir, entry));
      outputs.push({ file: entry, sizeBytes: stat.size, modifiedAt: stat.mtimeMs });
    } catch {
      // skip unreadable
    }
  }
  outputs.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return NextResponse.json({ outputs, outputDir: settings.outputDir });
};
