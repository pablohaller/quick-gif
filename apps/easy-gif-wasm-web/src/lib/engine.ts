import { buildPreChain, dimsAt, extFor, fitDimensions } from "@easy-gif/core";
import type { ExportParams, ExportResult, VideoMeta } from "@/lib/types";

// ---------------------------------------------------------------------------
// ffmpeg.wasm loader.
//
// The @ffmpeg/ffmpeg ESM entry uses `new URL(classWorkerURL, import.meta.url)`
// which bundlers (Turbopack/webpack) can't statically resolve, so instead we
// load the UMD build at runtime via a <script> tag — the bundler never sees it.
//
// All assets are self-hosted under public/ffmpeg (copied from @ffmpeg/core and
// @ffmpeg/ffmpeg) so there is no runtime CDN dependency — the app works offline
// and never fails because unpkg is slow or blocked.
//
// We must NOT pass `classWorkerURL`: doing so makes the UMD loader spawn the
// worker as a module worker (`{type:"module"}`), but 814.ffmpeg.js is a classic
// worker that calls importScripts() — unavailable in module workers. Omitting it
// lets the loader resolve /ffmpeg/814.ffmpeg.js itself as a classic worker
// (relative to where ffmpeg.js was loaded from), and we pass the core/wasm as
// plain same-origin URLs.
//
// This is the single-threaded core — no COOP/COEP headers required, so it
// deploys to any static host, and the core runs in its own Web Worker so the UI
// thread never blocks during a render.
// ---------------------------------------------------------------------------
const FFMPEG_BASE = "/ffmpeg";
const CORE_BASE = "/ffmpeg";
// A TTF for text drawtext (no system fonts exist in the wasm filesystem).
// Self-hosted (DejaVu Sans) so text layers work offline too.
const FONT_URL = "/ffmpeg/font.ttf";
const FONT_FILE = "font.ttf";

type FFmpegInstance = {
  load(opts: {
    coreURL: string;
    wasmURL: string;
    classWorkerURL?: string;
  }): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
  on(event: "log", cb: (e: { message: string }) => void): void;
  on(event: "progress", cb: (e: { progress: number }) => void): void;
};

declare global {
  interface Window {
    FFmpegWASM?: { FFmpeg: new () => FFmpegInstance };
  }
}

const fetchFile = async (input: string | File): Promise<Uint8Array> => {
  if (typeof input !== "string") {
    return new Uint8Array(await input.arrayBuffer());
  }
  const res = await fetch(input);
  return new Uint8Array(await res.arrayBuffer());
};

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.FFmpegWASM) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load ffmpeg.wasm"));
    document.head.appendChild(script);
  });

let instance: FFmpegInstance | null = null;
let loading: Promise<FFmpegInstance> | null = null;

// Routed to the active render's progress callback; a single listener (set up in
// loadFfmpeg) avoids stacking a new one per exec, which caused runaway values.
let progressCb: ((ratio: number) => void) | null = null;
// Each ffmpeg pass reports 0..1; this maps it into a slice of the overall render
// so the GIF's two passes read as one continuous 0..100%.
let progressRange = { base: 0, span: 1 };
// Recent ffmpeg log lines, used to enrich thrown errors.
const logTail: string[] = [];

export const loadFfmpeg = (
  onLog?: (msg: string) => void,
): Promise<FFmpegInstance> => {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      await loadScript(`${FFMPEG_BASE}/ffmpeg.js`);
      if (!window.FFmpegWASM) throw new Error("ffmpeg.wasm failed to initialise");
      const ff = new window.FFmpegWASM.FFmpeg();
      // Forward ffmpeg's stderr to the console and keep a tail for error context.
      ff.on("log", ({ message }) => {
        logTail.push(message);
        if (logTail.length > 50) logTail.shift();
        if (onLog) onLog(message);
        console.debug("[ffmpeg]", message);
      });
      // Clamp progress (the GIF palette pass can report absurd values) and map
      // it into the current pass's slice of the overall render.
      ff.on("progress", ({ progress }) => {
        const p = Math.max(0, Math.min(1, progress));
        progressCb?.(progressRange.base + progressRange.span * p);
      });
      // Absolute same-origin URLs; the worker resolves /ffmpeg/814.ffmpeg.js
      // itself (classic worker) and importScripts() these.
      const origin = window.location.origin;
      await ff.load({
        coreURL: `${origin}${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${origin}${CORE_BASE}/ffmpeg-core.wasm`,
      });
      instance = ff;
      return ff;
    })();
  }
  return loading;
};

let fontReady = false;
const ensureFont = async (ff: FFmpegInstance): Promise<boolean> => {
  if (fontReady) return true;
  try {
    await ff.writeFile(FONT_FILE, await fetchFile(FONT_URL));
    fontReady = true;
    return true;
  } catch {
    // Text is best-effort; skip the drawtext filters if the font won't load.
    return false;
  }
};

const WEBP_QUALITY = 75;

// -ss before -i (fast input seek); -t as an OUTPUT option (unambiguous length).
const seekArgs = (params: ExportParams): string[] =>
  params.start !== null ? ["-ss", String(params.start)] : [];
const durArgs = (params: ExportParams): string[] => {
  if (params.end === null) return [];
  const from = params.start ?? 0;
  return ["-t", String(Math.max(0, params.end - from))];
};

// Fail loudly: ffmpeg.wasm's exec resolves even when ffmpeg errors, so check the
// return code and surface the tail of the log.
const execChecked = async (ff: FFmpegInstance, args: string[]): Promise<void> => {
  const code = await ff.exec(args);
  if (code !== 0) {
    throw new Error(
      `ffmpeg failed (code ${code}).\n${logTail.slice(-10).join("\n")}`,
    );
  }
};

// Render one output to the wasm FS and return its bytes. WebP streams in a
// single pass; GIF uses a two-pass file-based palette (palettegen -> palette.png
// -> paletteuse), which is far more memory-friendly in wasm than the single-pass
// split[...]palettegen filter that buffers every frame.
const renderOnce = async (
  ff: FFmpegInstance,
  input: string,
  params: ExportParams,
  pre: string,
): Promise<Uint8Array> => {
  const ext = extFor(params.format);
  const output = `out.${ext}`;
  const seek = seekArgs(params);
  const dur = durArgs(params);

  if (params.format === "webp") {
    progressRange = { base: 0, span: 1 };
    await execChecked(ff, [
      "-y", ...seek, "-i", input, ...dur,
      "-vf", pre,
      "-c:v", "libwebp", "-loop", "0", "-q:v", String(WEBP_QUALITY),
      "-f", "webp", output,
    ]);
  } else {
    // Pass 1 (palette) is the smaller slice; pass 2 (render) is the bulk.
    progressRange = { base: 0, span: 0.3 };
    await execChecked(ff, [
      "-y", ...seek, "-i", input, ...dur,
      "-vf", `${pre},palettegen=stats_mode=diff`,
      "-y", "palette.png",
    ]);
    progressRange = { base: 0.3, span: 0.7 };
    await execChecked(ff, [
      "-y", ...seek, "-i", input, "-i", "palette.png", ...dur,
      "-lavfi", `[0:v]${pre}[x];[x][1:v]paletteuse=dither=bayer`,
      "-f", "gif", output,
    ]);
    await ff.deleteFile("palette.png").catch(() => {});
  }

  const data = (await ff.readFile(output)) as Uint8Array;
  await ff.deleteFile(output).catch(() => {});
  if (!data || data.byteLength === 0) {
    throw new Error(
      `Render produced an empty file.\n${logTail.slice(-10).join("\n")}`,
    );
  }
  return data;
};

const INPUT_FILE = "input";

// Write the source video into the wasm FS once; subsequent renders reuse it.
const writeInput = async (ff: FFmpegInstance, file: File): Promise<string> => {
  const name = `${INPUT_FILE}`;
  await ff.writeFile(name, await fetchFile(file));
  return name;
};

// Render once at full size and return the byte size, without downloading.
export const estimateSize = async (
  file: File,
  meta: VideoMeta,
  params: ExportParams,
  onProgress?: (ratio: number) => void,
): Promise<{ sizeBytes: number; width: number }> => {
  const ff = await loadFfmpeg();
  progressCb = onProgress ?? null;
  try {
    const input = await writeInput(ff, file);
    const hasFont = params.texts.some((t) => t.text.trim())
      ? await ensureFont(ff)
      : false;
    const { srcW, srcH, factor } = fitDimensions(params, meta);
    const { width, height } = dimsAt(srcW, srcH, factor, 1);
    const pre = buildPreChain(params, meta, width, height, hasFont ? FONT_FILE : null);
    const data = await renderOnce(ff, input, params, pre);
    return { sizeBytes: data.byteLength, width };
  } finally {
    progressCb = null;
  }
};

// Run an export end to end: render, enforce the size budget (auto-downscale).
export const runExport = async (
  file: File,
  meta: VideoMeta,
  params: ExportParams,
  onProgress?: (ratio: number) => void,
): Promise<ExportResult> => {
  const ff = await loadFfmpeg();
  progressCb = onProgress ?? null;
  try {
    const input = await writeInput(ff, file);
    const hasFont = params.texts.some((t) => t.text.trim())
      ? await ensureFont(ff)
      : false;

    const mime = params.format === "webp" ? "image/webp" : "image/gif";
    // maxSizeMB of 0 means "no budget": render once, never auto-downscale.
    const hasBudget = params.maxSizeMB > 0;
    const maxBytes = params.maxSizeMB * 1024 * 1024;

    const { srcW, srcH, factor } = fitDimensions(params, meta);
    let multiplier = 1;
    let dims = dimsAt(srcW, srcH, factor, multiplier);
    let downscaled = false;
    let data: Uint8Array = new Uint8Array();
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      dims = dimsAt(srcW, srcH, factor, multiplier);
      const pre = buildPreChain(params, meta, dims.width, dims.height, hasFont ? FONT_FILE : null);
      data = await renderOnce(ff, input, params, pre);
      if (!hasBudget || data.byteLength <= maxBytes || !params.autoDownscale) {
        break;
      }
      if (attempt < maxAttempts - 1) {
        multiplier *= 0.5;
        downscaled = true;
      }
    }

    const copy = new Uint8Array(data);
    return {
      blob: new Blob([copy], { type: mime }),
      sizeBytes: data.byteLength,
      downscaled,
      finalWidth: dims.width,
    };
  } finally {
    progressCb = null;
  }
};
