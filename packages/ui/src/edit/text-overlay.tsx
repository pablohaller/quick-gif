"use client";

import { useRef } from "react";
import type { TextLayer } from "@quick-gif/core";

type Props = {
  layers: TextLayer[];
  onChange: (id: string, patch: Partial<TextLayer>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Draggable text layers rendered over the video. The container is transparent
// to pointer events so the crop overlay beneath still works; only the text
// boxes grab events. Font size uses container-query height units so it tracks
// the video's displayed height (approximating the exported size).
export const TextOverlay = ({ layers, onChange, selectedId, onSelect }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const norm = (e: React.PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent, layer: TextLayer) => {
    e.stopPropagation();
    const p = norm(e);
    drag.current = { id: layer.id, dx: p.x - layer.x, dy: p.y - layer.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(layer.id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = norm(e);
    onChange(drag.current.id, {
      x: clamp01(p.x - drag.current.dx),
      y: clamp01(p.y - drag.current.dy),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{ containerType: "size" }}
    >
      {layers.map((layer) => (
        <div
          key={layer.id}
          onPointerDown={(e) => onPointerDown(e, layer)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`pointer-events-auto absolute cursor-move touch-none select-none whitespace-pre font-semibold leading-none ${
            selectedId === layer.id ? "outline-dashed outline-1 outline-cyan" : ""
          }`}
          style={{
            left: `${layer.x * 100}%`,
            top: `${layer.y * 100}%`,
            fontSize: `${layer.size * 100}cqh`,
            color: layer.color,
            opacity: layer.opacity,
          }}
        >
          {layer.text || "Text"}
        </div>
      ))}
    </div>
  );
};
