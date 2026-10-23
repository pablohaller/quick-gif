// Shared, engine-agnostic value types used by both the wasm and native apps.
// App-specific shapes (ExportResult, VideoMeta extras, OutputMeta, ActionResult)
// live in each app's own src/lib/types.ts, which re-exports from here.

export type OutputFormat = "gif" | "webp";

// Color filter: tint the video with a color using a blend mode (or grayscale).
export type ColorFilterMode = "none" | "grayscale" | "multiply" | "screen";
export type ColorFilter = { mode: ColorFilterMode; color: string };

// Crop rectangle in normalized 0..1 coordinates relative to the source frame.
export type CropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// A text overlay burned into the output. Position/size are normalized to the
// full source frame (0..1); size is a fraction of the frame height so it is
// resolution-independent.
export type TextLayer = {
  id: string;
  text: string;
  x: number; // 0..1 (left)
  y: number; // 0..1 (top)
  size: number; // fraction of frame height (e.g. 0.06)
  color: string; // #rrggbb
  opacity: number; // 0..1
};

// A reusable text style (a TextLayer without its placement/id).
export type TextPreset = {
  id: string;
  name?: string;
  text: string;
  size: number;
  color: string;
  opacity: number;
};

// A reusable color filter.
export type FilterPreset = {
  id: string;
  name?: string;
  mode: ColorFilterMode;
  color: string;
};

// Where an export reads its input from (native app only; wasm ignores it).
export type SourceKind = "watch" | "upload";

// The minimal media metadata the filtergraph needs. Both apps' richer VideoMeta
// are structurally assignable to this.
export type MediaMeta = {
  width: number;
  height: number;
  duration: number;
  fps: number;
};

export type ExportParams = {
  name: string;
  start: number | null;
  end: number | null;
  crop: CropRect | null;
  texts: TextLayer[];
  format: OutputFormat;
  // Optional: undefined/0 means "not applied" (source fps / no cap on that axis).
  fps?: number;
  width?: number; // max width — never upscales
  height?: number; // max height — never upscales
  filter: ColorFilter;
  maxSizeMB: number;
  autoDownscale: boolean;
  // Native app only; defaults to "watch" (the Library flow) when omitted.
  source?: SourceKind;
};
