"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { RenderProgress } from "@/components/edit/render-progress";
import { streamSSE } from "@/lib/sse";
import type { ExportParams, ExportResult } from "@/lib/types";

type Props = { params: ExportParams };

// Exports via the SSE route so the progress bar is real, then shows the file
// saved to the output folder (served back via /api/gif).
export const ExportButton = ({ params }: Props) => {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Scroll to the progress on start, then to the result when it lands.
  useEffect(() => {
    if (busy) progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [busy]);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      await streamSSE("/api/export/stream", params, {
        progress: setProgress,
        done: (data) => setResult(data as ExportResult),
        error: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!result) return;
    if (!window.confirm(`Delete ${result.file} from the output folder?`)) return;
    await fetch(`/api/gif?file=${encodeURIComponent(result.file)}`, { method: "DELETE" });
    setResult(null);
  };

  const label = params.format.toUpperCase();
  // Cache-bust once per result — recomputing on every render would reload the
  // image (and restart the animation) whenever an unrelated control changes.
  const previewSrc = useMemo(
    () => (result ? `/api/gif?file=${encodeURIComponent(result.file)}&cb=${Date.now()}` : ""),
    [result],
  );

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={run} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Rendering…
          </>
        ) : (
          `Export ${label}`
        )}
      </Button>

      <div ref={progressRef}>
        {busy ? <RenderProgress progress={progress} /> : null}
      </div>
      {error ? <p className="text-sm text-red">{error}</p> : null}

      {result ? (
        <div ref={resultRef} className="flex flex-col gap-2 rounded-lg border border-current-line bg-current-line p-3">
          <p className="text-sm text-green">
            {result.deduped ? `Identical ${label} already existed` : "Saved"}:{" "}
            <span className="text-foreground">{result.file}</span>
          </p>
          <p className="text-xs text-comment">
            {(result.sizeBytes / 1024 / 1024).toFixed(2)} MB · {result.finalWidth}px
            {result.downscaled ? " · auto-downscaled" : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* translateZ(0) gives the animation its own compositing layer so Chrome
              repaints every frame instead of showing a stale first-loop. */}
          <img
            src={previewSrc}
            alt={result.file}
            style={{ transform: "translateZ(0)" }}
            className="max-h-80 w-full rounded object-contain"
          />
          <div>
            <Button variant="danger" onClick={remove} className="px-3 py-1 text-sm">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
