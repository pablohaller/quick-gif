import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { resolveInDir } from "@/lib/ffmpeg";

const contentType = (file: string) =>
  path.extname(file).toLowerCase() === ".webp" ? "image/webp" : "image/gif";

export const GET = async (request: NextRequest) => {
  const file = request.nextUrl.searchParams.get("file");
  const asDownload = request.nextUrl.searchParams.get("dl") === "1";
  if (!file) return new Response("Missing file", { status: 400 });
  const settings = await loadSettings();
  let filePath: string;
  try {
    filePath = resolveInDir(settings.outputDir, file);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const buf = await fs.readFile(filePath);
    // Correct filename when viewing/saving (and force a download with ?dl=1).
    const disposition = `${asDownload ? "attachment" : "inline"}; filename="${file.replace(/"/g, "")}"`;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType(file),
        "Cache-Control": "no-store",
        "Content-Disposition": disposition,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

export const DELETE = async (request: NextRequest) => {
  const file = request.nextUrl.searchParams.get("file");
  if (!file) return new Response("Missing file", { status: 400 });
  const settings = await loadSettings();
  let filePath: string;
  try {
    filePath = resolveInDir(settings.outputDir, file);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    await fs.rm(filePath);
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
