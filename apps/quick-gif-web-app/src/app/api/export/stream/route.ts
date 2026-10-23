import { type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { runExport } from "@/lib/ffmpeg";
import type { ExportParams } from "@/lib/types";

// Streams export progress as Server-Sent Events, then a final "done"/"error".
export const POST = async (request: NextRequest) => {
  const params = (await request.json()) as ExportParams;
  const settings = await loadSettings();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      try {
        const result = await runExport(params, settings, (ratio) =>
          send("progress", { ratio }),
        );
        send("done", result);
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Export failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
