import { promises as fs } from "fs";
import path from "path";
import { settingsSchema, type Settings } from "@/lib/settings";

// Settings live in a JSON file next to the app (single-user local tool, no DB).
const CONFIG_PATH = path.join(process.cwd(), "giffer.config.json");

// Defaults: watch the parent folder, write to ../output, 8 MB budget, fps 15,
// 640px, dedup + cache on.
export const defaultSettings = (): Settings => ({
  watchDir: path.resolve(process.cwd(), ".."),
  outputDir: path.resolve(process.cwd(), "..", "output"),
  dedup: true,
  cacheEnabled: true,
  format: "gif",
  naming: "giffer_{timestamp}",
  width: 640,
  fps: 15,
  maxSizeMB: 8,
  autoDownscale: true,
});

export const loadSettings = async (): Promise<Settings> => {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return settingsSchema.parse({ ...defaultSettings(), ...JSON.parse(raw) });
  } catch {
    return defaultSettings();
  }
};

export const saveSettings = async (input: unknown): Promise<Settings> => {
  const parsed = settingsSchema.parse({ ...defaultSettings(), ...(input as object) });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
};
