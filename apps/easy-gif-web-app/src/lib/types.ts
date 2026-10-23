// Shared value types (ColorFilter, TextLayer, CropRect, ExportParams, presets,
// SourceKind…) come from @easy-gif/core; only native-app-specific shapes are
// declared here.
export * from "@easy-gif/core/types";

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

export type OutputMeta = {
  file: string;
  sizeBytes: number;
  modifiedAt: number;
};

export type ExportResult = {
  file: string;
  sizeBytes: number;
  downscaled: boolean;
  finalWidth: number;
  deduped: boolean;
};
