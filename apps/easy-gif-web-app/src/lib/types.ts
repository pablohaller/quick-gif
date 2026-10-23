export type ActionResult<T = undefined> =
  | { success: string; data?: T }
  | { error: string };

export type VideoMeta = {
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  sizeBytes: number;
  modifiedAt: number;
};

export type OutputFormat = "gif" | "webp";

export type OutputMeta = {
  file: string;
  sizeBytes: number;
  modifiedAt: number;
};

// Color filter: tint the video with a color using a blend mode (or grayscale).
export type ColorFilterMode = "none" | "grayscale" | "multiply" | "screen";
export type ColorFilter = { mode: ColorFilterMode; color: string };

// Where an export reads its input from: the watch folder, or an uploaded file.
export type SourceKind = "watch" | "upload";

// Crop rectangle in normalized 0..1 coordinates relative to the source frame.
export type CropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// A text overlay burned into the output. Position/size are normalized to the
// full source frame (0..1); size is a fraction of the frame height.
export type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
};

// Reusable presets (saved in localStorage settings, editable in Settings).
export type TextPreset = {
  id: string;
  name?: string;
  text: string;
  size: number;
  color: string;
  opacity: number;
};

export type FilterPreset = {
  id: string;
  name?: string;
  mode: ColorFilterMode;
  color: string;
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
  // Defaults to "watch" when omitted (the video Library flow).
  source?: SourceKind;
};

export type ExportResult = {
  file: string;
  sizeBytes: number;
  downscaled: boolean;
  finalWidth: number;
  deduped: boolean;
};
