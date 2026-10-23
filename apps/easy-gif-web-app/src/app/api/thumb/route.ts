import { execFile } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import type { NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { resolveInDir, sourceDir } from "@/lib/ffmpeg";
import { cacheKey, readThumb, writeThumb } from "@/lib/cache";
import type { SourceKind } from "@/lib/types";

const run = promisify(execFile);

const respond = (buf: Buffer, cached: boolean) =>
  new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cached ? "public, max-age=31536000, immutable" : "no-store",
    },
  });

export const GET = async (request: NextRequest) => {
  const name = request.nextUrl.searchParams.get("name");
  const at = Number(request.nextUrl.searchParams.get("t") ?? "0") || 0;
  const source = (request.nextUrl.searchParams.get("source") as SourceKind) ?? "watch";
  if (!name) return new Response("Missing name", { status: 400 });

  const settings = await loadSettings();
  let input: string;
  try {
    input = resolveInDir(sourceDir(settings, source), name);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  let key: string | null = null;
  if (settings.cacheEnabled) {
    try {
      const stat = await fs.stat(input);
      key = cacheKey(input, stat, `thumb:${at}`);
      const hit = await readThumb(key);
      if (hit) return respond(hit, true);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  try {
    const { stdout } = await run(
      "ffmpeg",
      ["-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=320:-1", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"],
      { encoding: "buffer", maxBuffer: 1024 * 1024 * 16 },
    );
    if (key) await writeThumb(key, stdout);
    return respond(stdout, key !== null);
  } catch {
    return new Response("Thumbnail failed", { status: 500 });
  }
};
