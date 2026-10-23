"use client";

import { forwardRef } from "react";
import { CropOverlay } from "./crop-overlay";
import { TextOverlay } from "./text-overlay";
import type { ColorFilter, CropRect, MediaMeta, TextLayer } from "@easy-gif/core";

type Props = {
  // Only width/height are read (aspect ratio); MediaMeta covers both apps' metas.
  meta: MediaMeta;
  // Object URL (wasm app) or streaming route URL (native app) for the video.
  src: string;
  crop: CropRect | null;
  onCrop: (crop: CropRect | null) => void;
  onTime: (t: number) => void;
  muted: boolean;
  filter: ColorFilter;
  texts: TextLayer[];
  onTextChange: (id: string, patch: Partial<TextLayer>) => void;
  selectedTextId: string | null;
  onTextSelect: (id: string) => void;
};

export const Player = forwardRef<HTMLVideoElement, Props>(
  (
    {
      meta,
      src,
      crop,
      onCrop,
      onTime,
      muted,
      filter,
      texts,
      onTextChange,
      selectedTextId,
      onTextSelect,
    },
    ref,
  ) => (
    <div
      className="relative mx-auto max-h-[50vh] overflow-hidden rounded-lg bg-black shadow-lg ring-1 ring-current-line"
      style={{ aspectRatio: `${meta.width} / ${meta.height}` }}
    >
      <video
        ref={ref}
        src={src}
        muted={muted}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
        className="h-full w-full object-contain"
        style={{ filter: filter.mode === "grayscale" ? "grayscale(1)" : undefined }}
        playsInline
      />
      {/* WYSIWYG tint: a colored overlay blended with the video below. */}
      {filter.mode === "multiply" || filter.mode === "screen" ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: filter.color, mixBlendMode: filter.mode }}
        />
      ) : null}
      <CropOverlay
        crop={crop}
        onChange={onCrop}
        sourceWidth={meta.width}
        sourceHeight={meta.height}
      />
      <TextOverlay
        layers={texts}
        onChange={onTextChange}
        selectedId={selectedTextId}
        onSelect={onTextSelect}
      />
    </div>
  ),
);

Player.displayName = "Player";
