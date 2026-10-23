import { NextResponse, type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { probe, resolveInDir, sourceDir } from "@/lib/ffmpeg";
import type { SourceKind } from "@/lib/types";

export const GET = async (request: NextRequest) => {
  const name = request.nextUrl.searchParams.get("name");
  const source = (request.nextUrl.searchParams.get("source") as SourceKind) ?? "watch";
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const settings = await loadSettings();
  try {
    const meta = await probe(resolveInDir(sourceDir(settings, source), name));
    return NextResponse.json({ data: meta });
  } catch {
    return NextResponse.json({ error: "Could not read that video" }, { status: 404 });
  }
};
