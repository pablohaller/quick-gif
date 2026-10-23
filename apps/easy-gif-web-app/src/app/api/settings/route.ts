import { NextResponse, type NextRequest } from "next/server";
import { loadSettings, saveSettings } from "@/lib/config";

export const GET = async () => NextResponse.json(await loadSettings());

export const PUT = async (request: NextRequest) => {
  try {
    const saved = await saveSettings(await request.json());
    return NextResponse.json({ success: "Saved", data: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
