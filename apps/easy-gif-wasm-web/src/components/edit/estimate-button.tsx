"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { RenderProgress } from "@easy-gif/ui/edit/render-progress";
import { estimateSize } from "@/lib/engine";
import type { ExportParams, VideoMeta } from "@/lib/types";

type Estimate = { sizeBytes: number; width: number };

type Props = {
  file: File;
  meta: VideoMeta;
  params: ExportParams;
};

export const EstimateButton = ({ file, meta, params }: Props) => {
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
      const data = await estimateSize(file, meta, params, setProgress);
      setEstimate(data);
    } catch (e) {
      console.error("Estimate failed:", e);
      setError(e instanceof Error ? e.message : String(e) || "Estimate failed");
    } finally {
      setBusy(false);
    }
  };

  const mb = estimate ? estimate.sizeBytes / 1024 / 1024 : 0;
  // maxSizeMB of 0 means no budget, so nothing is ever "over".
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
