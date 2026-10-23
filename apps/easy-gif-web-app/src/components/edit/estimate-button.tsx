"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { RenderProgress } from "@/components/edit/render-progress";
import { streamSSE } from "@/lib/sse";
import type { ExportParams } from "@/lib/types";

type Estimate = { sizeBytes: number; width: number };
type Props = { params: ExportParams };

export const EstimateButton = ({ params }: Props) => {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setBusy(true);
    setError(null);
    setEstimate(null);
    setProgress(0);
    try {
      await streamSSE("/api/estimate/stream", params, {
        progress: setProgress,
        done: (data) => setEstimate(data as Estimate),
        error: setError,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  };

  const mb = estimate ? estimate.sizeBytes / 1024 / 1024 : 0;
  const over = estimate && params.maxSizeMB > 0 ? mb > params.maxSizeMB : false;

  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" className="w-full py-2.5" onClick={run} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating…
          </>
        ) : (
          "Estimate size"
        )}
      </Button>
      {busy ? <RenderProgress progress={progress} /> : null}
      {error ? <span className="text-sm text-red">{error}</span> : null}
      {estimate ? (
        <span className={`text-sm ${over ? "text-red" : "text-green"}`}>
          ≈ {mb.toFixed(2)} MB at {estimate.width}px
          {over ? ` · over ${params.maxSizeMB} MB budget` : ""}
        </span>
      ) : null}
    </div>
  );
};
