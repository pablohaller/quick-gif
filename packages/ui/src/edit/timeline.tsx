"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatTime } from "@quick-gif/core";

type Props = {
  duration: number;
  current: number;
  start: number;
  end: number;
  // Optional fixed replay point, drawn as a draggable marker.
  anchor?: number | null;
  onAnchor?: (t: number) => void;
  onSeek: (t: number) => void;
  onStart: (t: number) => void;
  onEnd: (t: number) => void;
  onCommit?: () => void;
  // Returns a cached poster-frame data URL for the given time, or null.
  thumbFor: (t: number) => string | null;
};

const THUMB_COUNT = 10;
const MIN_WINDOW = 0.05; // smallest zoom window in seconds

const ToolButton = ({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className="inline-flex items-center gap-1 rounded border border-comment px-2 py-1 text-xs text-foreground hover:bg-background"
  >
    {children}
  </button>
);

export const Timeline = ({
  duration,
  current,
  start,
  end,
  anchor,
  onAnchor,
  onSeek,
  onStart,
  onEnd,
  onCommit,
  thumbFor,
}: Props) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"start" | "end" | "anchor" | "seek" | null>(null);
  const [view, setView] = useState({ start: 0, end: duration || 0 });

  const viewDur = Math.max(MIN_WINDOW, view.end - view.start);

  const thumbs = useMemo(
    () =>
      Array.from(
        { length: THUMB_COUNT },
        (_, i) => view.start + viewDur * ((i + 0.5) / THUMB_COUNT),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.start, view.end],
  );

  const timeAt = (clientX: number) => {
    const box = trackRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return view.start + ratio * viewDur;
  };

  const pct = (t: number) =>
    `${Math.min(100, Math.max(0, ((t - view.start) / viewDur) * 100))}%`;

  const onPointerDown =
    (which: "start" | "end" | "anchor" | "seek") => (e: React.PointerEvent) => {
      e.stopPropagation();
      dragging.current = which;
      trackRef.current!.setPointerCapture(e.pointerId);
      if (which === "seek") onSeek(timeAt(e.clientX));
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const t = timeAt(e.clientX);
    if (dragging.current === "start") onStart(Math.min(t, end - 0.02));
    else if (dragging.current === "end") onEnd(Math.max(t, start + 0.02));
    else if (dragging.current === "anchor")
      onAnchor?.(Math.min(duration, Math.max(0, t)));
    else onSeek(t);
  };

  const onPointerUp = () => {
    const was = dragging.current;
    dragging.current = null;
    if ((was === "start" || was === "end") && onCommit) onCommit();
  };

  // Keep a window within [0, duration], shifting rather than clipping when possible.
  const applyWindow = (s: number, e: number) => {
    let ns = s;
    let ne = e;
    if (ns < 0) {
      ne -= ns;
      ns = 0;
    }
    if (ne > duration) {
      ns -= ne - duration;
      ne = duration;
    }
    setView({ start: Math.max(0, ns), end: Math.min(duration, ne) });
  };

  const zoom = (factor: number, center = current) => {
    const nd = Math.min(duration, Math.max(MIN_WINDOW, viewDur * factor));
    applyWindow(center - nd / 2, center + nd / 2);
  };

  const fit = () => setView({ start: 0, end: duration });
  const zoomToSelection = () => {
    const pad = Math.max(0.05, (end - start) * 0.1);
    applyWindow(start - pad, end + pad);
  };
  const pan = (frac: number) => applyWindow(view.start + viewDur * frac, view.end + viewDur * frac);

  const zoomFactor = viewDur ? duration / viewDur : 1;

  // Scroll-to-zoom over the track, centered on the cursor — mirrors the + / −
  // buttons. Kept in a ref so the native (non-passive) listener always sees the
  // latest view without re-subscribing.
  const wheelHandler = useRef<(e: WheelEvent) => void>(() => {});
  wheelHandler.current = (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.8 : 1.25, timeAt(e.clientX));
  };
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandler.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // A thin visible line (so the exact boundary is readable) plus a big circular,
  // touch-friendly grab handle (40x40 hit area) centered on it. Used for the
  // in/out points (purple) and the replay anchor (orange).
  const renderHandle = (
    which: "start" | "end" | "anchor",
    at: number,
    color: string,
  ) => (
    <div key={which}>
      {/* thin marker line, full track height, non-interactive */}
      <div
        className={`pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 ${color}`}
        style={{ left: pct(at) }}
      />
      {/* 40x40 circular grab target, absolutely centered on the line */}
      <div
        onPointerDown={onPointerDown(which)}
        className="absolute top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full"
        style={{ left: pct(at) }}
      >
        <div
          className={`h-5 w-5 rounded-full border-2 border-background shadow-md transition-transform active:scale-110 ${color}`}
        />
      </div>
    </div>
  );

  return (
    <div className="select-none">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ToolButton onClick={() => pan(-0.25)} title="Pan left">
          <ChevronLeft className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => zoom(0.5)} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => zoom(2)} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => pan(0.25)} title="Pan right">
          <ChevronRight className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={zoomToSelection} title="Zoom to selection">
          <Maximize2 className="h-3.5 w-3.5" />
          Fit selection
        </ToolButton>
        <ToolButton onClick={fit} title="Reset zoom">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </ToolButton>
        <span className="text-xs text-comment">
          {zoomFactor.toFixed(1)}× · {formatTime(view.start)}–{formatTime(view.end)}
        </span>
      </div>

      <div className="relative">
      <div
        ref={trackRef}
        onPointerDown={onPointerDown("seek")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-16 w-full touch-none overflow-hidden rounded border border-current-line"
      >
        <div className="flex h-full w-full">
          {thumbs.map((t, i) => {
            const url = thumbFor(t);
            return (
              <div
                key={`${i}-${t.toFixed(2)}`}
                className={`h-full flex-1 ${
                  url ? "bg-background" : "animate-pulse bg-current-line/40"
                }`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover opacity-70"
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Dimmed regions outside the selection */}
        <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: pct(start) }} />
        <div className="absolute inset-y-0 right-0 bg-background/70" style={{ left: pct(end) }} />

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan"
          style={{ left: pct(current) }}
        />

      </div>

        {/* In / out (purple) and anchor (orange) handles — outside the clipped
            track so the circular grips are never cut off at the edges */}
        {anchor !== null && anchor !== undefined
          ? renderHandle("anchor", anchor, "bg-orange")
          : null}
        {renderHandle("start", start, "bg-purple")}
        {renderHandle("end", end, "bg-purple")}
      </div>

      <div className="mt-2 flex justify-between text-xs text-comment">
        <span>In {formatTime(start)}</span>
        <span className="text-cyan">{formatTime(current)}</span>
        <span>
          Out {formatTime(end)} · {formatTime(end - start)} clip
        </span>
      </div>
    </div>
  );
};
