// Shared value types (ColorFilter, TextLayer, CropRect, ExportParams, presets…)
// come from @easy-gif/core; only wasm-app-specific shapes are declared here.
export * from "@easy-gif/core/types";

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

// Result of an in-browser render: the bytes plus how they were produced.
export type ExportResult = {
  blob: Blob;
  sizeBytes: number;
  downscaled: boolean;
  finalWidth: number;
};
