import { NextResponse, type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { estimateSize } from "@/lib/ffmpeg";
import type { ExportParams } from "@/lib/types";

export const POST = async (request: NextRequest) => {
  const params = (await request.json()) as ExportParams;
  if (!params?.name) {
    return NextResponse.json({ error: "Missing video name" }, { status: 400 });
  }
  try {
    const settings = await loadSettings();
    const data = await estimateSize(params, settings);
    return NextResponse.json({ success: "Estimated", data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Estimate failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
