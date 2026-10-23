import { createReadStream } from "fs";
import { promises as fs } from "fs";
import type { NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { resolveInDir, sourceDir } from "@/lib/ffmpeg";
import type { SourceKind } from "@/lib/types";
import path from "path";
import { Readable } from "stream";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".avi": "video/x-msvideo",
};

export const GET = async (request: NextRequest) => {
  const name = request.nextUrl.searchParams.get("name");
  const source = (request.nextUrl.searchParams.get("source") as SourceKind) ?? "watch";
  if (!name) return new Response("Missing name", { status: 400 });

  const settings = await loadSettings();
  let filePath: string;
  try {
    filePath = resolveInDir(sourceDir(settings, source), name);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  let size: number;
  try {
    size = (await fs.stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const type = MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : size - 1;
    const chunk = createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(chunk) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": type,
      },
    });
  }
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Content-Type": type,
    },
  });
};
