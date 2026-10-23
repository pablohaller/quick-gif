import { promises as fs } from "fs";
import path from "path";
import { loadSettings } from "@/lib/config";
import { resolveInDir } from "@/lib/ffmpeg";

const contentType = (file: string) =>
  path.extname(file).toLowerCase() === ".webp" ? "image/webp" : "image/gif";

// Serves an output file at a clean URL (e.g. /output/giffer_123.webp) so
// opening it looks like the file itself rather than an /api/... route.
export const GET = async (
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) => {
  const { file } = await ctx.params;
  const settings = await loadSettings();
  let filePath: string;
  try {
    filePath = resolveInDir(settings.outputDir, decodeURIComponent(file));
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const buf = await fs.readFile(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType(file),
        "Content-Disposition": `inline; filename="${file.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
