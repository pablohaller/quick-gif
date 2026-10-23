"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { OutputMeta } from "@/lib/types";

const formatSize = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

// Light static thumbnail by default; swaps to the full animated file on hover.
export const OutputCard = ({
  o,
  onDelete,
}: {
  o: OutputMeta;
  onDelete: (file: string) => void;
}) => {
  const [hover, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // ffmpeg can't decode animated WebP, so its thumbnail fails — fall back to the
  // full file (browsers render it natively), lazily loaded to keep the grid light.
  const [thumbFailed, setThumbFailed] = useState(false);
  const openUrl = `/output/${encodeURIComponent(o.file)}`;
  const fullUrl = `${openUrl}?v=${o.modifiedAt}`;
  const thumbUrl = `/api/output-thumb?file=${encodeURIComponent(o.file)}&v=${o.modifiedAt}`;
  const showFull = hover || thumbFailed;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-current-line bg-current-line"
    >
      <a href={openUrl} target="_blank" rel="noreferrer" title="Open">
        <div className="relative aspect-video w-full bg-background">
          {!loaded ? <div className="absolute inset-0 animate-pulse bg-current-line/50" /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={showFull ? fullUrl : thumbUrl}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setThumbFailed(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
      </a>
      <div className="flex items-center justify-between gap-2 p-2">
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-sm hover:text-cyan"
          title={o.file}
        >
          {o.file}
        </a>
        <span className="shrink-0 text-xs text-comment">{formatSize(o.sizeBytes)}</span>
      </div>
      <button
        type="button"
        aria-label="Delete output"
        onClick={() => onDelete(o.file)}
        className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-comment opacity-0 transition hover:text-red group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};
