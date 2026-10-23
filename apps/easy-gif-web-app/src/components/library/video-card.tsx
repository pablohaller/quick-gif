"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { EDIT, generateRoute } from "@/lib/routes";
import type { VideoMeta } from "@/lib/types";

const formatBytes = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

// Poster thumbnail by default; plays the video (muted) on hover.
export const VideoCard = ({
  v,
  onDelete,
}: {
  v: VideoMeta;
  onDelete: (name: string) => void;
}) => {
  const [hover, setHover] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const editUrl = generateRoute(EDIT, { name: v.name });
  const thumbUrl = `/api/thumb?name=${encodeURIComponent(v.name)}&t=0&source=watch&v=${v.modifiedAt}`;
  const videoUrl = `/api/media?name=${encodeURIComponent(v.name)}&source=watch`;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-current-line bg-current-line"
    >
      <Link href={editUrl} className="block">
        {hover ? (
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="aspect-video w-full bg-background object-cover"
          />
        ) : (
          <div className="relative aspect-video w-full bg-background">
            {!loaded ? <div className="absolute inset-0 animate-pulse bg-current-line/50" /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl}
              alt=""
              onLoad={() => setLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        )}
        <div className="flex flex-col gap-0.5 p-2">
          <span className="truncate text-sm" title={v.name}>{v.name}</span>
          <span className="text-xs text-comment">{formatBytes(v.sizeBytes)}</span>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Delete video"
        onClick={() => onDelete(v.name)}
        className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-comment opacity-0 transition hover:text-red group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};
