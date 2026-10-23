import { NextResponse, type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { runExport } from "@/lib/ffmpeg";
import type { ExportParams } from "@/lib/types";

export const POST = async (request: NextRequest) => {
  const params = (await request.json()) as ExportParams;
  if (!params?.name) {
    return NextResponse.json({ error: "Missing video name" }, { status: 400 });
  }
  try {
    const settings = await loadSettings();
    const result = await runExport(params, settings);
    return NextResponse.json({ success: "Exported", data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
