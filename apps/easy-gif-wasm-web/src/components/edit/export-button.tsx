"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { RenderProgress } from "@/components/edit/render-progress";
import { runExport } from "@/lib/engine";
import { resolveName } from "@/lib/naming";
import type { ExportParams, ExportResult, VideoMeta } from "@/lib/types";

type Props = {
  file: File;
  meta: VideoMeta;
  params: ExportParams;
  naming: string;
};

export const ExportButton = ({ file, meta, params, naming }: Props) => {
  const [result, setResult] = useState<ExportResult | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Revoke the previous object URL whenever the preview changes/unmounts.
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = previewSrc;
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [previewSrc]);

  // Bring the Download button into view once a render finishes.
  const downloadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) {
      downloadRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setPreviewSrc(null);
    setProgress(0);
    try {
      const data = await runExport(file, meta, params, setProgress);
      const stem = params.name.replace(/\.[^/.]+$/, "");
      setResult(data);
      setPreviewSrc(URL.createObjectURL(data.blob));
      setFilename(resolveName(naming, stem, params.format));
    } catch (e) {
      console.error("Export failed:", e);
      setError(e instanceof Error ? e.message : String(e) || "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!previewSrc || !filename) return;
    const a = document.createElement("a");
    a.href = previewSrc;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const label = params.format.toUpperCase();

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

      {busy ? <RenderProgress progress={progress} /> : null}

      {error ? <p className="text-sm text-red">{error}</p> : null}

      {result ? (
        <div className="flex flex-col gap-2 rounded-lg border border-current-line bg-current-line p-3">
          <p className="text-sm text-green">
            Rendered:{" "}
            <span className="text-foreground">{filename}</span>
          </p>
          <p className="text-xs text-comment">
            {(result.sizeBytes / 1024 / 1024).toFixed(2)} MB · {result.finalWidth}px
            {result.downscaled ? " · auto-downscaled" : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc ?? ""}
            alt={filename ?? ""}
            className="max-h-80 w-full rounded object-contain"
          />
          <div ref={downloadRef}>
            <Button onClick={download} className="px-3 py-1 text-sm">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
