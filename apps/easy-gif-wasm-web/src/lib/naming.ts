import type { OutputFormat } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

export const extFor = (format: OutputFormat) =>
  format === "webp" ? "webp" : "gif";

// Resolve the naming template to a download filename (without directory).
// Tokens: {timestamp} YYYYMMDDHHMMSS, {stem} source filename. {timestamp} keeps
// each export unique, which is what matters without an output folder.
export const resolveName = (
  template: string,
  stem: string,
  format: OutputFormat,
): string => {
  const now = new Date();
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const base = template
    .replace(/\{timestamp\}/g, timestamp)
    .replace(/\{stem\}/g, stem);

  return `${base}.${extFor(format)}`;
};
