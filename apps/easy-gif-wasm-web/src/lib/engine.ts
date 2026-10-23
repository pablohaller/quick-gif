import { extFor } from "@/lib/naming";
import type { ColorFilter, ExportParams, ExportResult, VideoMeta } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Filtergraph. Order is: crop -> fps -> scale -> color -> text -> palette.
// ---------------------------------------------------------------------------
const hexToRgb01 = (hex: string): [number, number, number] => {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// A single-stream color filter. multiply: out = in * color.  screen:
// out = in*(1-color) + color (uses colorchannelmixer's alpha coefficient as the
// constant term, since opaque video has alpha = 1).
const colorFilter = (filter: ColorFilter): string | null => {
  if (filter.mode === "none") return null;
  if (filter.mode === "grayscale") return "hue=s=0";
  const [r, g, b] = hexToRgb01(filter.color);
  const f = (n: number) => n.toFixed(4);
  if (filter.mode === "multiply") {
    return `colorchannelmixer=rr=${f(r)}:gg=${f(g)}:bb=${f(b)}`;
  }
  // screen
  return `colorchannelmixer=rr=${f(1 - r)}:ra=${f(r)}:gg=${f(1 - g)}:ga=${f(g)}:bb=${f(1 - b)}:ba=${f(b)}`;
};

const escapeDrawtext = (text: string) =>
  text.replace(/[\\:',%[\]]/g, (c) => `\\${c}`).replace(/[\r\n]/g, " ");

// ffmpeg drawtext colour: #rrggbb -> 0xrrggbb@alpha.
const ffColor = (hex: string, opacity: number) => {
  const h = hex.replace(/^#/, "");
  const a = Math.max(0, Math.min(1, opacity)).toFixed(2);
  return `0x${h}@${a}`;
};

// Build one drawtext per text layer. Positions/size are normalized to the full
// frame, so they are remapped into the cropped+scaled output space. Text outside
// the crop lands off-canvas and is naturally clipped ("inside the area" only).
const textFilters = (
  params: ExportParams,
  finalWidth: number,
  finalHeight: number,
): string[] => {
  const cx = params.crop?.x ?? 0;
  const cy = params.crop?.y ?? 0;
  const cw = params.crop?.w ?? 1;
  const ch = params.crop?.h ?? 1;
  return params.texts
    .filter((layer) => layer.text.trim())
    .map((layer) => {
      const text = escapeDrawtext(layer.text.trim());
      const x = Math.round(((layer.x - cx) / cw) * finalWidth);
      const y = Math.round(((layer.y - cy) / ch) * finalHeight);
      const fontsize = Math.max(1, Math.round((layer.size * finalHeight) / ch));
      return `drawtext=fontfile=${FONT_FILE}:text='${text}':fontsize=${fontsize}:fontcolor=${ffColor(layer.color, layer.opacity)}:x=${x}:y=${y}`;
    });
};

// The "pre" chain (crop -> fps -> scale -> color -> text), WITHOUT the GIF
// palette step. GIF appends the palette in a separate pass (see renderOnce).
const buildPreChain = (
  params: ExportParams,
  meta: VideoMeta,
  finalWidth: number,
  finalHeight: number,
  hasFont: boolean,
): string => {
  const parts: string[] = [];

  if (params.crop) {
    const cw = Math.max(2, Math.round(params.crop.w * meta.width));
    const ch = Math.max(2, Math.round(params.crop.h * meta.height));
    const cx = Math.max(0, Math.round(params.crop.x * meta.width));
    const cy = Math.max(0, Math.round(params.crop.y * meta.height));
    parts.push(`crop=${cw}:${ch}:${cx}:${cy}`);
  }

  // fps is optional — omit to keep the source frame rate.
  if (params.fps !== undefined) parts.push(`fps=${params.fps}`);
  // Dimensions are computed in JS (aspect-correct, never upscaled), so scale to
  // the explicit target.
  parts.push(`scale=${finalWidth}:${finalHeight}:flags=lanczos`);

  const color = colorFilter(params.filter);
  if (color) parts.push(color);

  if (hasFont) parts.push(...textFilters(params, finalWidth, finalHeight));

  return parts.join(",");
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

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

// Fit-to-box dimensions: scale the (cropped) source down to fit inside the
// optional max width/height while preserving aspect ratio, never upscaling.
// Returns the source size and a single scale factor (≤ 1) so the auto-downscale
// loop can shrink both axes proportionally.
const fitDimensions = (params: ExportParams, meta: VideoMeta) => {
  const srcW = params.crop
    ? Math.max(2, Math.round(params.crop.w * meta.width))
    : meta.width;
  const srcH = params.crop
    ? Math.max(2, Math.round(params.crop.h * meta.height))
    : meta.height;

  // A value of 0 (or unset) means "no cap on that axis" — keep the source size.
  const capW = params.width ? Math.min(params.width, srcW) : undefined;
  const capH = params.height ? Math.min(params.height, srcH) : undefined;

  let factor = 1;
  if (capW !== undefined && capH !== undefined) {
    factor = Math.min(capW / srcW, capH / srcH);
  } else if (capW !== undefined) {
    factor = capW / srcW;
  } else if (capH !== undefined) {
    factor = capH / srcH;
  }

  return { srcW, srcH, factor };
};

// Final even width/height at an extra downscale multiplier (1 = none).
const dimsAt = (
  srcW: number,
  srcH: number,
  factor: number,
  multiplier: number,
) => ({
  width: even(srcW * factor * multiplier),
  height: even(srcH * factor * multiplier),
});

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
    const pre = buildPreChain(params, meta, width, height, hasFont);
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
      const pre = buildPreChain(params, meta, dims.width, dims.height, hasFont);
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
