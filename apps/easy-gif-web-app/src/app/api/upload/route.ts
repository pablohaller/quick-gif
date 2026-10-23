import { promises as fs } from "fs";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";
import { UPLOADS_DIR } from "@/lib/cache";
import { probe, resolveInDir } from "@/lib/ffmpeg";

const ALLOWED = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v", ".gif", ".webp"];

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
  ".avi": "video/x-msvideo",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const contentType = (name: string) =>
  MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";

// Store an uploaded video (or GIF/WebP) and return its probed metadata so the
// editor can open it with source="upload".
export const POST = async (request: NextRequest) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  // Prefix with a timestamp to avoid collisions; keep a sanitized base name.
  const base = path.basename(file.name).replace(/[^\w.-]+/g, "_");
  const name = `${Date.now()}-${base}`;
  const dest = resolveInDir(UPLOADS_DIR, name);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(dest, buf);

  try {
    const meta = await probe(dest);
    return NextResponse.json({ success: "Uploaded", data: meta });
  } catch {
    await fs.rm(dest, { force: true });
    return NextResponse.json(
      { error: "Could not read that file" },
      { status: 400 },
    );
  }
};

// Serve an uploaded file.
export const GET = async (request: NextRequest) => {
  const name = request.nextUrl.searchParams.get("name");
  if (!name) return new Response("Missing name", { status: 400 });

  let filePath: string;
  try {
    filePath = resolveInDir(UPLOADS_DIR, name);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const buf = await fs.readFile(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType(name),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
