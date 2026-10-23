import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

// Local directory browser backing the folder picker in Settings. The app already
// lets the user target any path, so listing directories here is not a new exposure.
const list = async (dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = path.dirname(dir);
  return { path: dir, parent: parent === dir ? null : parent, entries: dirs };
};

export const GET = async (request: NextRequest) => {
  const requested = request.nextUrl.searchParams.get("path");
  const dir = requested?.trim() ? path.resolve(requested) : os.homedir();
  try {
    return NextResponse.json(await list(dir));
  } catch {
    // Requested path is gone or unreadable — fall back to the home directory.
    try {
      return NextResponse.json(await list(os.homedir()));
    } catch {
      return NextResponse.json({ path: dir, parent: null, entries: [] });
    }
  }
};
