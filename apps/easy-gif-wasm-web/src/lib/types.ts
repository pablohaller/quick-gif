// Metadata read from an uploaded video via an HTML5 <video> element.
// fps isn't cheaply available in the browser, so it's a best-effort default.
export type VideoMeta = {
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  sizeBytes: number;
};

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

// A text overlay burned into the GIF. Position/size are normalized to the full
// source frame (0..1); size is a fraction of the frame height so it is
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

export type ExportParams = {
  name: string;
  start: number | null;
  end: number | null;
  crop: CropRect | null;
  texts: TextLayer[];
  format: OutputFormat;
  // Optional: undefined means "not applied" (source fps / no size cap on that axis).
  fps?: number;
  width?: number; // max width — never upscales
  height?: number; // max height — never upscales
  filter: ColorFilter;
  maxSizeMB: number;
  autoDownscale: boolean;
};

// Result of an in-browser render: the bytes plus how they were produced.
export type ExportResult = {
  blob: Blob;
  sizeBytes: number;
  downscaled: boolean;
  finalWidth: number;
};
