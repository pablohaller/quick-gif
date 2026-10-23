"use client";

import { useRef } from "react";
import type { CropRect } from "@quick-gif/core";

type Props = {
  crop: CropRect | null;
  onChange: (crop: CropRect | null) => void;
  // Source dimensions, used to label the selection in pixels.
  sourceWidth?: number;
  sourceHeight?: number;
};

type Mode =
  | { kind: "draw"; ox: number; oy: number }
  | { kind: "move"; ox: number; oy: number; start: CropRect }
  | { kind: "resize"; corner: Corner; start: CropRect };

type Corner = "nw" | "ne" | "sw" | "se";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Normalize a rect so w/h stay positive.
const normalize = (r: CropRect): CropRect => ({
  x: Math.min(r.x, r.x + r.w),
  y: Math.min(r.y, r.y + r.h),
  w: Math.abs(r.w),
  h: Math.abs(r.h),
});

export const CropOverlay = ({
  crop,
  onChange,
  sourceWidth,
  sourceHeight,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useRef<Mode | null>(null);

  const pointer = (e: React.PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    };
  };

  const onPointerDownBackground = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // started on rect/handle
    // Keep an existing selection when clicking elsewhere — only draw a fresh one
    // when none exists (use the handles to resize or "Clear crop" to start over).
    if (crop) return;
    const p = pointer(e);
    mode.current = { kind: "draw", ox: p.x, oy: p.y };
    ref.current!.setPointerCapture(e.pointerId);
    onChange({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const startMove = (e: React.PointerEvent) => {
    if (!crop) return;
    e.stopPropagation();
    const p = pointer(e);
    mode.current = { kind: "move", ox: p.x, oy: p.y, start: crop };
    ref.current!.setPointerCapture(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, corner: Corner) => {
    if (!crop) return;
    e.stopPropagation();
    mode.current = { kind: "resize", corner, start: crop };
    ref.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const m = mode.current;
    if (!m) return;
    const p = pointer(e);

    if (m.kind === "draw") {
      onChange(normalize({ x: m.ox, y: m.oy, w: p.x - m.ox, h: p.y - m.oy }));
    } else if (m.kind === "move") {
      const dx = p.x - m.ox;
      const dy = p.y - m.oy;
      onChange({
        x: clamp01(m.start.x + dx),
        y: clamp01(m.start.y + dy),
        w: Math.min(m.start.w, 1 - clamp01(m.start.x + dx)),
        h: Math.min(m.start.h, 1 - clamp01(m.start.y + dy)),
      });
    } else {
      const r = { ...m.start };
      const right = r.x + r.w;
      const bottom = r.y + r.h;
      if (m.corner === "nw") onChange(normalize({ x: p.x, y: p.y, w: right - p.x, h: bottom - p.y }));
      if (m.corner === "ne") onChange(normalize({ x: r.x, y: p.y, w: p.x - r.x, h: bottom - p.y }));
      if (m.corner === "sw") onChange(normalize({ x: p.x, y: r.y, w: right - p.x, h: p.y - r.y }));
      if (m.corner === "se") onChange(normalize({ x: r.x, y: r.y, w: p.x - r.x, h: p.y - r.y }));
    }
  };

  const onPointerUp = () => {
    const m = mode.current;
    mode.current = null;
    // Discard tiny accidental selections.
    if (m?.kind === "draw" && crop && (crop.w < 0.02 || crop.h < 0.02)) {
      onChange(null);
    }
  };

  const handle = (corner: Corner, pos: string) => (
    <div
      onPointerDown={(e) => startResize(e, corner)}
      className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-purple ${pos}`}
    />
  );

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDownBackground}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute inset-0 cursor-crosshair touch-none"
    >
      {crop ? (
        <div
          onPointerDown={startMove}
          className="absolute cursor-move border-2 border-purple bg-purple/10"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        >
          {sourceWidth && sourceHeight && crop.w > 0.02 && crop.h > 0.02 ? (
            <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/80 px-1.5 py-0.5 text-xs font-medium text-foreground">
              {Math.round(crop.w * sourceWidth)}×{Math.round(crop.h * sourceHeight)}
            </span>
          ) : null}
          {handle("nw", "left-0 top-0")}
          {handle("ne", "left-full top-0")}
          {handle("sw", "left-0 top-full")}
          {handle("se", "left-full top-full")}
        </div>
      ) : null}
    </div>
  );
};
