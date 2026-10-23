import type { ColorFilter, ExportParams, MediaMeta } from "./types";

// ---------------------------------------------------------------------------
// Engine-agnostic ffmpeg filtergraph construction, shared by the wasm and
// native apps. Order is: crop -> fps -> scale -> color -> text. The GIF palette
// step differs per engine (native appends it single-pass; wasm uses a two-pass
// file-based palette for memory), so it is NOT part of the pre-chain.
// ---------------------------------------------------------------------------

const hexToRgb01 = (hex: string): [number, number, number] => {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// A single-stream color filter. multiply: out = in * color.  screen:
// out = in*(1-color) + color (uses colorchannelmixer's alpha coefficient as the
// constant term, since opaque video has alpha = 1).
export const colorFilter = (filter: ColorFilter): string | null => {
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

// One drawtext per text layer, remapped from normalized full-frame coordinates
// into the cropped+scaled output space (layers outside the crop are clipped).
// fontFile is the concrete font path for the engine (a wasm FS path or a
// resolved system font).
export const textFilters = (
  params: ExportParams,
  finalWidth: number,
  finalHeight: number,
  fontFile: string,
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
      return `drawtext=fontfile=${fontFile}:text='${text}':fontsize=${fontsize}:fontcolor=${ffColor(layer.color, layer.opacity)}:x=${x}:y=${y}`;
    });
};

// crop -> fps -> scale -> color -> text, WITHOUT any palette step. Pass a
// fontFile to burn text; null skips text (no font available).
export const buildPreChain = (
  params: ExportParams,
  meta: MediaMeta,
  finalWidth: number,
  finalHeight: number,
  fontFile: string | null,
): string => {
  const parts: string[] = [];

  if (params.crop) {
    const cw = Math.max(2, Math.round(params.crop.w * meta.width));
    const ch = Math.max(2, Math.round(params.crop.h * meta.height));
    const cx = Math.max(0, Math.round(params.crop.x * meta.width));
    const cy = Math.max(0, Math.round(params.crop.y * meta.height));
    parts.push(`crop=${cw}:${ch}:${cx}:${cy}`);
  }

  // fps is optional — omit (undefined or 0) to keep the source frame rate.
  if (params.fps) parts.push(`fps=${params.fps}`);
  // Dimensions are computed in JS (aspect-correct, never upscaled).
  parts.push(`scale=${finalWidth}:${finalHeight}:flags=lanczos`);

  const color = colorFilter(params.filter);
  if (color) parts.push(color);

  if (fontFile) parts.push(...textFilters(params, finalWidth, finalHeight, fontFile));

  return parts.join(",");
};

// Append the native single-pass GIF palette to a pre-chain. (The wasm app does a
// two-pass file-based palette instead and does not use this.)
export const singlePassGifChain = (pre: string): string =>
  `${pre},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

// Fit-to-box dimensions: scale the (cropped) source down to fit inside the
// optional max width/height, aspect preserved, never upscaled. Returns the
// source size and a single scale factor (<= 1) so an auto-downscale loop can
// shrink both axes proportionally. A cap of 0/unset means "no cap on that axis".
export const fitDimensions = (params: ExportParams, meta: MediaMeta) => {
  const srcW = params.crop
    ? Math.max(2, Math.round(params.crop.w * meta.width))
    : meta.width;
  const srcH = params.crop
    ? Math.max(2, Math.round(params.crop.h * meta.height))
    : meta.height;

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
export const dimsAt = (
  srcW: number,
  srcH: number,
  factor: number,
  multiplier: number,
) => ({
  width: even(srcW * factor * multiplier),
  height: even(srcH * factor * multiplier),
});
