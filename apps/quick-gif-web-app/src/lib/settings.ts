import { z } from "zod";
import type { ColorFilter } from "@/lib/types";

// The settings SHAPE (client-safe — no fs). The values live server-side in
// giffer.config.json; the client reads/writes them via /api/settings.
export const settingsSchema = z.object({
  // Server paths & output options — always present.
  watchDir: z.string(),
  outputDir: z.string(),
  dedup: z.boolean(),
  cacheEnabled: z.boolean(),
  format: z.enum(["gif", "webp"]),
  naming: z.string().min(1),
  // Optional editor defaults — "present = enabled".
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().int().positive().optional(),
  maxSizeMB: z.number().positive().optional(),
  autoDownscale: z.boolean().optional(),
  filter: z
    .object({
      mode: z.enum(["none", "grayscale", "multiply", "screen"]),
      color: z.string(),
    })
    .optional(),
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

export const FIELD_DEFAULTS = {
  width: 640,
  height: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
  filter: { mode: "none", color: DEFAULT_FILTER_COLOR } as ColorFilter,
};

export const EXAMPLE_SETTINGS: Settings = {
  watchDir: "/path/to/videos",
  outputDir: "/path/to/output",
  dedup: true,
  cacheEnabled: true,
  format: "gif",
  naming: "giffer_{timestamp}",
  width: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
  filter: { mode: "multiply", color: "#ffcc66" },
};

export const parseSettings = (input: unknown): Settings =>
  settingsSchema.parse(input);

// --- Client helpers: read/write the server config via /api/settings ---
export const fetchSettings = async (): Promise<Settings> => {
  const res = await fetch("/api/settings");
  return settingsSchema.parse(await res.json());
};

export const putSettings = async (settings: Settings): Promise<void> => {
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
};
