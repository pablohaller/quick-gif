import { promises as fs } from "fs";
import type { Stats } from "fs";
import { createHash } from "crypto";
import path from "path";

// Disk cache for expensive ffmpeg output (poster frames, probe metadata).
// Lives in the app dir so it survives `next build` and reboots, unlike .next
// (wiped on rebuild) or the OS temp dir (cleared on reboot). Gitignored.
export const CACHE_DIR = path.join(process.cwd(), ".giffer-cache");
const THUMB_DIR = path.join(CACHE_DIR, "thumbs");
const META_DIR = path.join(CACHE_DIR, "meta");
// Uploaded GIFs/WebPs for the /gif crop page. Lives under the cache dir so
// "Clear cache" tidies it and it's covered by the same gitignore entry.
export const UPLOADS_DIR = path.join(CACHE_DIR, "uploads");

// Key from the source identity: path + mtime + size. A new or modified file
// yields a new key, so stale entries are simply never read again — the cache
// "revalidates" only when a file actually changes. Optional suffix (e.g. a
// thumbnail time offset) distinguishes variants of the same source.
export const cacheKey = (filePath: string, stat: Stats, suffix = ""): string =>
  createHash("md5")
    .update(`${filePath}:${stat.mtimeMs}:${stat.size}:${suffix}`)
    .digest("hex");

export const readThumb = async (key: string): Promise<Buffer | null> => {
  try {
    return await fs.readFile(path.join(THUMB_DIR, `${key}.jpg`));
  } catch {
    return null;
  }
};

export const writeThumb = async (key: string, buf: Buffer): Promise<void> => {
  await fs.mkdir(THUMB_DIR, { recursive: true });
  await fs.writeFile(path.join(THUMB_DIR, `${key}.jpg`), buf);
};

export const readMeta = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(path.join(META_DIR, `${key}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeMeta = async (key: string, data: unknown): Promise<void> => {
  await fs.mkdir(META_DIR, { recursive: true });
  await fs.writeFile(
    path.join(META_DIR, `${key}.json`),
    JSON.stringify(data),
    "utf8",
  );
};

// Total bytes stored under the cache dir (0 if it doesn't exist yet).
export const cacheSize = async (): Promise<number> => {
  const walk = async (dir: string): Promise<number> => {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    let total = 0;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await walk(full);
      } else {
        try {
          total += (await fs.stat(full)).size;
        } catch {
          // skip unreadable files
        }
      }
    }
    return total;
  };
  return walk(CACHE_DIR);
};

export const clearCache = async (): Promise<void> => {
  await fs.rm(CACHE_DIR, { recursive: true, force: true });
};
