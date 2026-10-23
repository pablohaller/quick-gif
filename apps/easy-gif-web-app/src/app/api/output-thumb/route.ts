import { execFile } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import type { NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { resolveInDir } from "@/lib/ffmpeg";
import { cacheKey, readThumb, writeThumb } from "@/lib/cache";

const run = promisify(execFile);

const respond = (buf: Buffer, cached: boolean) =>
  new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cached ? "public, max-age=31536000, immutable" : "no-store",
    },
  });

// A small (320px) static poster frame of an OUTPUT GIF/WebP, cached to disk.
// Used for the grid so the Outputs page stays light; the full file loads on hover.
export const GET = async (request: NextRequest) => {
  const file = request.nextUrl.searchParams.get("file");
  if (!file) return new Response("Missing file", { status: 400 });
  const settings = await loadSettings();
  let input: string;
  try {
    input = resolveInDir(settings.outputDir, file);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  let key: string | null = null;
  if (settings.cacheEnabled) {
    try {
      const stat = await fs.stat(input);
      key = cacheKey(input, stat, "outthumb");
      const hit = await readThumb(key);
      if (hit) return respond(hit, true);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  try {
    const { stdout } = await run(
      "ffmpeg",
      ["-i", input, "-frames:v", "1", "-vf", "scale=320:-1", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"],
      { encoding: "buffer", maxBuffer: 1024 * 1024 * 16 },
    );
    if (key) await writeThumb(key, stdout);
    return respond(stdout, key !== null);
  } catch {
    return new Response("Thumbnail failed", { status: 500 });
  }
};
