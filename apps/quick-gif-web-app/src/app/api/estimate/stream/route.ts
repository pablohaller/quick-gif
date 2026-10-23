import { type NextRequest } from "next/server";
import { loadSettings } from "@/lib/config";
import { estimateSize } from "@/lib/ffmpeg";
import type { ExportParams } from "@/lib/types";

// Streams estimate progress as SSE, then a final "done"/"error".
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
        const data = await estimateSize(params, settings, (ratio) =>
          send("progress", { ratio }),
        );
        send("done", data);
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Estimate failed",
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
