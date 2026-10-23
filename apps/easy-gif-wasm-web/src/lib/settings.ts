import { z } from "zod";
import type {
  ColorFilter,
  FilterPreset,
  OutputFormat,
  TextPreset,
} from "@/lib/types";

// Settings persist in localStorage — this is a single-user, in-browser tool.
//
// Model: `format` and `naming` are always present. Every other field is
// OPTIONAL — its presence means "this control is enabled by default". A settings
// JSON can therefore omit keys to leave those controls off. The Studio seeds its
// per-field enable checkboxes from which keys are present; toggling them there
// affects only the current creation, never localStorage.
const STORAGE_KEY = "quick-gif.settings";

export const settingsSchema = z.object({
  format: z.enum(["gif", "webp"]),
  naming: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  // 0 is not meaningful here — omit the key to disable the size budget.
  maxSizeMB: z.number().positive().optional(),
  autoDownscale: z.boolean().optional(),
  filter: z
    .object({
      mode: z.enum(["none", "grayscale", "multiply", "screen"]),
      color: z.string(),
    })
    .optional(),
  // Reusable presets; saved from the Studio, editable from Settings.
  textPresets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        text: z.string(),
        size: z.number(),
        color: z.string(),
        opacity: z.number(),
      }),
    )
    .optional(),
  filterPresets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        mode: z.enum(["none", "grayscale", "multiply", "screen"]),
        color: z.string(),
      }),
    )
    .optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

const DEFAULT_FILTER_COLOR = "#ff3b30";

// Fallback values shown (greyed) when a control is disabled, and the baseline
// when the user first enables one.
export const FIELD_DEFAULTS = {
  width: 640,
  height: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
  filter: { mode: "none", color: DEFAULT_FILTER_COLOR } as ColorFilter,
};

export const defaultSettings = (): Settings => ({
  format: "gif" as OutputFormat,
  naming: "giffer_{timestamp}",
  width: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
});

// Example used by the Settings page "Download example" action and docs.
export const EXAMPLE_SETTINGS: Settings = {
  format: "gif",
  naming: "giffer_{timestamp}",
  width: 640,
  height: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
  filter: { mode: "multiply", color: "#ffcc66" },
};

export const loadSettings = (): Settings => {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return settingsSchema.parse(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = (input: unknown): Settings => {
  const parsed = settingsSchema.parse(input);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  return parsed;
};

// Parse an uploaded settings JSON, stripping unknown keys and empty optionals.
export const parseSettings = (input: unknown): Settings =>
  settingsSchema.parse(input);

// Persist presets without disturbing the user's other saved defaults. Never
// throws: a persistence failure must not propagate out of a React event handler
// (that would discard the state update that triggered it — e.g. a rename).
export const savePresets = (
  textPresets: TextPreset[],
  filterPresets: FilterPreset[],
): void => {
  try {
    const current = loadSettings();
    saveSettings({
      ...current,
      textPresets: textPresets.length ? textPresets : undefined,
      filterPresets: filterPresets.length ? filterPresets : undefined,
    });
  } catch (e) {
    console.error("Failed to persist presets:", e);
  }
};
