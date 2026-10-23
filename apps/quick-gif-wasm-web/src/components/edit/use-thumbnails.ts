"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Seek the video and resolve once the frame at `target` is available. Setting
// currentTime to its existing value fires no "seeked" event, so short-circuit
// that case; a timeout guards against any missed event so the queue never hangs.
const seekTo = (video: HTMLVideoElement, target: number): Promise<void> =>
  new Promise((resolve) => {
    if (Math.abs(video.currentTime - target) < 0.02 && video.readyState >= 2) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 2000);
    video.addEventListener("seeked", finish);
    video.currentTime = target;
  });

// Generates timeline poster frames entirely in the browser: a dedicated
// offscreen <video> is seeked to each requested time and drawn to a canvas.
// Seeks are serialized (one at a time) and results cached by timestamp, so the
// filmstrip fills in progressively and re-zooming reuses frames it already has.
export const useThumbnails = (src: string | null, width = 240) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cache = useRef<Map<string, string>>(new Map());
  const queue = useRef<number[]>([]);
  const busy = useRef(false);
  // Bump to re-render the timeline as new frames land in the cache.
  const [, bump] = useState(0);

  useEffect(() => {
    cache.current = new Map();
    queue.current = [];
    busy.current = false;
    if (!src) {
      videoRef.current = null;
      return;
    }
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    videoRef.current = v;
    bump((n) => n + 1);
    return () => {
      videoRef.current = null;
    };
  }, [src]);

  const process = useCallback(async () => {
    if (busy.current) return;
    const v = videoRef.current;
    if (!v) return;
    busy.current = true;
    try {
      // Wait until a frame can actually be drawn (not just metadata).
      if (v.readyState < 2) {
        await new Promise<void>((resolve) => {
          const done = () => {
            v.removeEventListener("loadeddata", done);
            resolve();
          };
          v.addEventListener("loadeddata", done);
        });
      }
      while (queue.current.length) {
        const t = queue.current.shift()!;
        const key = t.toFixed(2);
        if (cache.current.has(key)) continue;
        const duration = v.duration || t;
        const target = Math.max(0, Math.min(t, duration - 0.001));
        await seekTo(v, target);
        const vw = v.videoWidth || width;
        const vh = v.videoHeight || width;
        const h = Math.max(1, Math.round((width * vh) / vw));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(v, 0, 0, width, h);
          cache.current.set(key, canvas.toDataURL("image/jpeg", 0.6));
          bump((n) => n + 1);
        }
      }
    } finally {
      busy.current = false;
    }
  }, [width]);

  // Returns a cached data URL, or null while it schedules generation.
  return useCallback(
    (t: number): string | null => {
      const key = t.toFixed(2);
      const hit = cache.current.get(key);
      if (hit) return hit;
      if (!queue.current.includes(t)) {
        queue.current.push(t);
        void process();
      }
      return null;
    },
    [process],
  );
};
