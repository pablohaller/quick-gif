import { extFor, fillTemplate, type OutputFormat } from "@quick-gif/core";

export { extFor };

// Resolve the naming template to a download filename (without directory).
// Tokens: {timestamp} YYYYMMDDHHMMSS, {stem} source filename. {timestamp} keeps
// each export unique, which is what matters without an output folder.
export const resolveName = (
  template: string,
  stem: string,
  format: OutputFormat,
): string => `${fillTemplate(template, { stem })}.${extFor(format)}`;
