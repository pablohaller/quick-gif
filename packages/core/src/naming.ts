import type { OutputFormat } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export const extFor = (format: OutputFormat) =>
  format === "webp" ? "webp" : "gif";

// YYYYMMDDHHMMSS for the {timestamp} token.
export const timestampNow = (now = new Date()): string =>
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

// Fill a naming template's tokens. {n} is caller-supplied (the native app uses a
// filesystem-collision counter; the wasm app has no folder so it omits it).
export const fillTemplate = (
  template: string,
  tokens: { stem: string; timestamp?: string; n?: string },
): string =>
  template
    .replace(/\{timestamp\}/g, tokens.timestamp ?? timestampNow())
    .replace(/\{stem\}/g, tokens.stem)
    .replace(/\{n\}/g, tokens.n ?? "");
