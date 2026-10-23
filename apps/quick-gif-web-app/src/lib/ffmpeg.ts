import { execFile, spawn } from "child_process";
import { promises as fs } from "fs";
import { createHash } from "crypto";
import os from "os";
import path from "path";
import { promisify } from "util";
import {
  buildPreChain,
  dimsAt,
  extFor,
  fitDimensions,
  singlePassGifChain,
} from "@quick-gif/core";
import type { ExportParams, ExportResult, SourceKind, VideoMeta } from "@/lib/types";
import type { Settings } from "@/lib/settings";
import { cacheKey, readMeta, writeMeta, UPLOADS_DIR } from "@/lib/cache";

const run = promisify(execFile);

// Directory an export/estimate reads its input from, by source kind.
export const sourceDir = (settings: Settings, source?: SourceKind): string =>
  source === "upload" ? UPLOADS_DIR : settings.watchDir;

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"];

// Output extensions we recognise in the outputs folder (dedup, listing, naming).
export const OUTPUT_EXTENSIONS = [".gif", ".webp"];

export const isVideo = (name: string) =>
  VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase());

// Resolve a user-supplied filename against a trusted directory, rejecting traversal.
export const resolveInDir = (dir: string, name: string): string => {
  const resolved = path.resolve(dir, name);
  const base = path.resolve(dir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Path outside allowed directory");
  }
  return resolved;
};

export const probe = async (filePath: string): Promise<VideoMeta> => {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const [num, den] = String(stream.r_frame_rate ?? "0/1").split("/");
  const fps = Number(den) ? Number(num) / Number(den) : 0;
  const stat = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    width: Number(stream.width) || 0,
    height: Number(stream.height) || 0,
    duration: Number(data.format?.duration) || 0,
    fps: Math.round(fps * 100) / 100,
    sizeBytes: stat.size,
    modifiedAt: stat.mtimeMs,
  };
};

// probe() that serves from the disk cache when enabled, keyed by file identity
// so metadata is re-probed only when the source file changes.
export const probeCached = async (
  filePath: string,
  useCache: boolean,
): Promise<VideoMeta> => {
  if (!useCache) return probe(filePath);
  const stat = await fs.stat(filePath);
  const key = cacheKey(filePath, stat, "probe");
  const hit = await readMeta<VideoMeta>(key);
  if (hit) return hit;
  const meta = await probe(filePath);
  await writeMeta(key, meta);
  return meta;
};

// ---------------------------------------------------------------------------
// Filtergraph: crop -> fps -> scale -> color -> text -> palette. The shared
// builder lives in @quick-gif/core; here we resolve a concrete system font for
// drawtext and append the native single-pass GIF palette.
// ---------------------------------------------------------------------------

// First existing font wins; drawtext needs a concrete file on macOS.
const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/Library/Fonts/Arial.ttf",
];

const findFont = async (): Promise<string | null> => {
  for (const font of FONT_CANDIDATES) {
    try {
      await fs.access(font);
      return font;
    } catch {
      // try next
    }
  }
  return null;
};

// Full native chain: the shared pre-chain, plus the single-pass GIF palette
// (WebP is full-colour, so the pre-chain is enough on its own).
const buildFilterChain = (
  params: ExportParams,
  meta: VideoMeta,
  finalWidth: number,
  finalHeight: number,
  fontFile: string | null,
): string => {
  const pre = buildPreChain(params, meta, finalWidth, finalHeight, fontFile);
  return params.format === "webp" ? pre : singlePassGifChain(pre);
};

// WebP quality for the lossy encoder. ~75 is a good size/quality balance.
const WEBP_QUALITY = 75;

export type ProgressFn = (ratio: number) => void;

// Spawn ffmpeg and resolve on exit, optionally streaming progress parsed from
// `-progress pipe:1` (out_time_us / clip duration).
const spawnFfmpeg = (
  args: string[],
  durationSec: number,
  onProgress?: ProgressFn,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    let errTail = "";
    child.stderr.on("data", (d) => {
      errTail = (errTail + d.toString()).slice(-2000);
    });
    if (onProgress) {
      child.stdout.on("data", (d) => {
        const m = /out_time_us=(\d+)/.exec(d.toString());
        if (m && durationSec > 0) {
          onProgress(Math.max(0, Math.min(1, Number(m[1]) / 1e6 / durationSec)));
        }
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed: ${errTail.slice(-500)}`));
    });
  });

const runFfmpeg = async (
  input: string,
  output: string,
  params: ExportParams,
  meta: VideoMeta,
  finalWidth: number,
  finalHeight: number,
  fontFile: string | null,
  onProgress?: ProgressFn,
) => {
  const filter = buildFilterChain(params, meta, finalWidth, finalHeight, fontFile);
  const args = ["-y"];
  // Fast input seek, then an explicit output duration (unambiguous vs -to).
  if (params.start !== null) args.push("-ss", String(params.start));
  args.push("-i", input);
  const clip =
    (params.end ?? meta.duration) - (params.start ?? 0);
  if (params.end !== null) args.push("-t", String(Math.max(0, clip)));
  if (onProgress) args.push("-progress", "pipe:1", "-nostats");
  args.push("-vf", filter);
  if (params.format === "webp") {
    args.push("-c:v", "libwebp", "-loop", "0", "-q:v", String(WEBP_QUALITY), "-f", "webp", output);
  } else {
    args.push("-f", "gif", output);
  }

  if (onProgress) {
    await spawnFfmpeg(args, Math.max(0, clip), onProgress);
    return;
  }
  try {
    await run("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    throw new Error(
      `ffmpeg failed: ${(err.stderr ?? err.message ?? "").slice(-500)}`,
    );
  }
};

// Render once at full size and return the byte size, without saving/dedup.
export const estimateSize = async (
  params: ExportParams,
  settings: Settings,
  onProgress?: ProgressFn,
): Promise<{ sizeBytes: number; width: number }> => {
  const input = resolveInDir(sourceDir(settings, params.source), params.name);
  const meta = await probe(input);
  const fontFile = params.texts.some((t) => t.text.trim()) ? await findFont() : null;
  const { srcW, srcH, factor } = fitDimensions(params, meta);
  const { width, height } = dimsAt(srcW, srcH, factor, 1);
  const tmp = path.join(os.tmpdir(), `qgif-est-${Date.now()}.${extFor(params.format)}`);
  try {
    await runFfmpeg(input, tmp, params, meta, width, height, fontFile, onProgress);
    return { sizeBytes: (await fs.stat(tmp)).size, width };
  } finally {
    await fs.rm(tmp, { force: true });
  }
};

const md5 = async (filePath: string): Promise<string> => {
  const buf = await fs.readFile(filePath);
  return createHash("md5").update(buf).digest("hex");
};

// Find an existing output of the same format in dir with the same hash (dedup).
const findDuplicate = async (
  dir: string,
  hash: string,
  ext: string,
): Promise<string | null> => {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(`.${ext}`)) continue;
    try {
      if ((await md5(path.join(dir, entry))) === hash) return entry;
    } catch {
      // ignore unreadable files
    }
  }
  return null;
};

const pad = (n: number) => String(n).padStart(2, "0");

// Resolve the naming template to a collision-free filename (without directory).
const resolveName = async (
  template: string,
  stem: string,
  dir: string,
  ext: string,
): Promise<string> => {
  const now = new Date();
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  let existing: string[] = [];
  try {
    existing = await fs.readdir(dir);
  } catch {
    // dir may not exist yet
  }
  const taken = new Set(existing.map((e) => e.toLowerCase()));

  const nextSequential = () => {
    let n = 1;
    while (taken.has(`${n}.${ext}`)) n += 1;
    return String(n);
  };

  const base = template
    .replace(/\{timestamp\}/g, timestamp)
    .replace(/\{stem\}/g, stem)
    .replace(/\{n\}/g, nextSequential());

  let candidate = `${base}.${ext}`;
  let seq = 1;
  while (taken.has(candidate.toLowerCase())) {
    seq += 1;
    candidate = `${base}${seq}.${ext}`;
  }
  return candidate;
};

// Run an export end to end: render, enforce size budget (auto-downscale), dedup, name.
// outputDir, dedup and the naming template come from the request (localStorage).
export const runExport = async (
  params: ExportParams,
  settings: Settings,
  onProgress?: ProgressFn,
): Promise<ExportResult> => {
  const input = resolveInDir(sourceDir(settings, params.source), params.name);
  const meta = await probe(input);
  const fontFile = params.texts.some((t) => t.text.trim()) ? await findFont() : null;
  await fs.mkdir(settings.outputDir, { recursive: true });

  const ext = extFor(params.format);
  // maxSizeMB of 0 means "no budget": render once, never auto-downscale.
  const hasBudget = params.maxSizeMB > 0;
  const maxBytes = params.maxSizeMB * 1024 * 1024;
  // Render to the OS temp dir, then move into the output folder once finalized.
  const tmp = path.join(os.tmpdir(), `qgif-tmp-${Date.now()}.${ext}`);

  const { srcW, srcH, factor } = fitDimensions(params, meta);
  let multiplier = 1;
  let dims = dimsAt(srcW, srcH, factor, multiplier);
  let downscaled = false;
  let sizeBytes = 0;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    dims = dimsAt(srcW, srcH, factor, multiplier);
    await runFfmpeg(input, tmp, params, meta, dims.width, dims.height, fontFile, onProgress);
    sizeBytes = (await fs.stat(tmp)).size;
    if (!hasBudget || sizeBytes <= maxBytes || !params.autoDownscale) break;
    if (attempt < maxAttempts - 1) {
      multiplier *= 0.5;
      downscaled = true;
    }
  }

  const stem = path.parse(params.name).name;

  if (settings.dedup) {
    const hash = await md5(tmp);
    const dup = await findDuplicate(settings.outputDir, hash, ext);
    if (dup) {
      await fs.rm(tmp, { force: true });
      const dupSize = (await fs.stat(path.join(settings.outputDir, dup))).size;
      return {
        file: dup,
        sizeBytes: dupSize,
        downscaled,
        finalWidth: dims.width,
        deduped: true,
      };
    }
  }

  const name = await resolveName(settings.naming, stem, settings.outputDir, ext);
  const dest = path.join(settings.outputDir, name);
  // rename fails across volumes (temp dir vs output); fall back to copy+unlink.
  try {
    await fs.rename(tmp, dest);
  } catch {
    await fs.copyFile(tmp, dest);
    await fs.rm(tmp, { force: true });
  }

  return { file: name, sizeBytes, downscaled, finalWidth: dims.width, deduped: false };
};
