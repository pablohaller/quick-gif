"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  ChevronLeft,
  ChevronRight,
  CropIcon,
  LogIn,
  LogOut,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Player } from "@/components/edit/player";
import { Timeline } from "@/components/edit/timeline";
import { Controls, type ControlValues } from "@/components/edit/controls";
import { TextControls } from "@/components/edit/text-controls";
import { EstimateButton } from "@/components/edit/estimate-button";
import { ExportButton } from "@/components/edit/export-button";
import { Button } from "@/components/ui/button";
import { HOME } from "@/lib/routes";
import { FIELD_DEFAULTS, putSettings, type Settings } from "@/lib/settings";
import type {
  CropRect,
  ExportParams,
  FilterPreset,
  SourceKind,
  TextLayer,
  TextPreset,
  VideoMeta,
} from "@/lib/types";

const round = (n: number) => Math.round(n * 1000) / 1000;

const controlsFromSettings = (s: Settings): ControlValues => ({
  format: s.format,
  width: { enabled: s.width !== undefined, value: s.width ?? FIELD_DEFAULTS.width },
  height: { enabled: s.height !== undefined, value: s.height ?? FIELD_DEFAULTS.height },
  fps: { enabled: s.fps !== undefined, value: s.fps ?? FIELD_DEFAULTS.fps },
  size: {
    enabled: s.maxSizeMB !== undefined,
    value: s.maxSizeMB ?? FIELD_DEFAULTS.maxSizeMB,
    autoDownscale: s.autoDownscale ?? FIELD_DEFAULTS.autoDownscale,
  },
  filter: s.filter ?? { ...FIELD_DEFAULTS.filter },
});

type Props = { meta: VideoMeta; name: string; source: SourceKind; settings: Settings };

export const Editor = ({ meta, name, source, settings }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Persist presets to the server config without changing other settings.
  const persist = (tp: TextPreset[], fp: FilterPreset[]) =>
    void putSettings({
      ...settings,
      textPresets: tp.length ? tp : undefined,
      filterPresets: fp.length ? fp : undefined,
    });

  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(meta.duration);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textPresets, setTextPresets] = useState<TextPreset[]>(settings.textPresets ?? []);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(settings.filterPresets ?? []);
  const [autoReplay, setAutoReplay] = useState(true);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pauseOnSeek, setPauseOnSeek] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const loopCooldown = useRef(0);

  const [controls, setControls] = useState<ControlValues>(() =>
    controlsFromSettings(settings),
  );

  const src =
    source === "upload"
      ? `/api/upload?name=${encodeURIComponent(name)}`
      : `/api/media?name=${encodeURIComponent(name)}&source=watch`;

  const thumbFor = (t: number): string =>
    `/api/thumb?name=${encodeURIComponent(name)}&t=${t.toFixed(2)}&source=${source}`;

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Warn before leaving (reload / close) — a trimmed edit is unsaved.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const addText = () => {
    const id = crypto.randomUUID();
    setTexts((prev) => [
      ...prev,
      { id, text: "Text", x: 0.3, y: 0.08, size: 0.07, color: "#ffffff", opacity: 1 },
    ]);
    setSelectedTextId(id);
  };

  const changeText = (id: string, patch: Partial<TextLayer>) =>
    setTexts((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const removeText = (id: string) => {
    setTexts((prev) => prev.filter((l) => l.id !== id));
    setSelectedTextId((cur) => (cur === id ? null : cur));
  };

  const saveTextPreset = (layer: TextLayer) => {
    const preset: TextPreset = {
      id: crypto.randomUUID(),
      name: layer.text || "Text",
      text: layer.text,
      size: layer.size,
      color: layer.color,
      opacity: layer.opacity,
    };
    const next = [...textPresets, preset];
    setTextPresets(next);
    persist(next, filterPresets);
  };

  const renameTextPreset = (id: string, label: string) => {
    const next = textPresets.map((p) => (p.id === id ? { ...p, name: label } : p));
    setTextPresets(next);
    persist(next, filterPresets);
  };

  const loadTextPreset = (preset: TextPreset) => {
    const id = crypto.randomUUID();
    setTexts((prev) => [
      ...prev,
      { id, text: preset.text, x: 0.3, y: 0.08, size: preset.size, color: preset.color, opacity: preset.opacity },
    ]);
    setSelectedTextId(id);
  };

  const removeTextPreset = (id: string) => {
    const next = textPresets.filter((p) => p.id !== id);
    setTextPresets(next);
    persist(next, filterPresets);
  };

  const saveFilterPreset = () => {
    if (controls.filter.mode === "none") return;
    const label =
      controls.filter.mode.charAt(0).toUpperCase() + controls.filter.mode.slice(1);
    const preset: FilterPreset = {
      id: crypto.randomUUID(),
      name: label,
      mode: controls.filter.mode,
      color: controls.filter.color,
    };
    const next = [...filterPresets, preset];
    setFilterPresets(next);
    persist(textPresets, next);
  };

  const renameFilterPreset = (id: string, label: string) => {
    const next = filterPresets.map((p) => (p.id === id ? { ...p, name: label } : p));
    setFilterPresets(next);
    persist(textPresets, next);
  };

  const loadFilterPreset = (preset: FilterPreset) =>
    setControls((prev) => ({ ...prev, filter: { mode: preset.mode, color: preset.color } }));

  const removeFilterPreset = (id: string) => {
    const next = filterPresets.filter((p) => p.id !== id);
    setFilterPresets(next);
    persist(textPresets, next);
  };

  const replayStart = anchor ?? start;

  const onTime = (t: number) => setCurrent(t);

  const seek = (t: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = t;
      if (pauseOnSeek) video.pause();
    }
    setCurrent(t);
  };

  const playPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < replayStart || video.currentTime >= end) {
        loopCooldown.current = performance.now() + 150;
        video.currentTime = replayStart;
      }
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const replay = (from = replayStart) => {
    const video = videoRef.current;
    if (!video) return;
    loopCooldown.current = performance.now() + 150;
    video.currentTime = from;
    setCurrent(from);
    void video.play().catch(() => {});
  };

  const stepFrame = (dir: 1 | -1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const step = meta.fps ? 1 / meta.fps : 1 / 30;
    const t = Math.min(meta.duration, Math.max(0, video.currentTime + dir * step));
    video.currentTime = t;
    setCurrent(t);
  };

  const setIn = () => {
    const t = round(current);
    setStart(t);
    if (autoReplay) replay(t);
  };

  const onTrimCommit = () => {
    if (autoReplay) replay();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
      if (e.code === "Space") {
        if (inField) return;
        e.preventDefault();
        if (tag === "BUTTON") el?.blur();
        playPause();
      } else if (e.code === "ArrowLeft") {
        if (inField) return;
        e.preventDefault();
        stepFrame(-1);
      } else if (e.code === "ArrowRight") {
        if (inField) return;
        e.preventDefault();
        stepFrame(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, anchor]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      const now = performance.now();
      if (
        video &&
        !video.paused &&
        !video.seeking &&
        now >= loopCooldown.current &&
        (video.currentTime >= end || video.currentTime < replayStart - 0.001)
      ) {
        loopCooldown.current = now + 150;
        video.currentTime = replayStart;
        setCurrent(replayStart);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, replayStart]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      loopCooldown.current = performance.now() + 150;
      video.currentTime = replayStart;
      setCurrent(replayStart);
      void video.play().catch(() => {});
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [replayStart]);

  const params: ExportParams = {
    name: meta.name,
    start: round(start),
    end: round(end),
    crop,
    texts,
    format: controls.format,
    fps: controls.fps.enabled ? controls.fps.value : undefined,
    width: controls.width.enabled ? controls.width.value : undefined,
    height: controls.height.enabled ? controls.height.value : undefined,
    filter: controls.filter,
    maxSizeMB: controls.size.enabled ? controls.size.value : 0,
    autoDownscale: controls.size.enabled ? controls.size.autoDownscale : false,
    source,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-sm text-comment">
          <span className="font-medium text-foreground">{meta.name}</span>
          {"  ·  "}
          {meta.width}×{meta.height} · {meta.duration.toFixed(1)}s
        </p>
        <Link href={HOME} className="shrink-0 text-cyan hover:underline">
          ← Library
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <Player
            ref={videoRef}
            meta={meta}
            src={src}
            crop={crop}
            onCrop={setCrop}
            onTime={onTime}
            muted={muted}
            filter={controls.filter}
            texts={texts}
            onTextChange={changeText}
            selectedTextId={selectedTextId}
            onTextSelect={setSelectedTextId}
          />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={playPause}>
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Play
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => replay()}>
                <RotateCcw className="h-4 w-4" />
                Replay
              </Button>
              <Button variant="ghost" size="sm" onClick={() => stepFrame(-1)}>
                <ChevronLeft className="h-4 w-4" />
                Frame
              </Button>
              <Button variant="ghost" size="sm" onClick={() => stepFrame(1)}>
                Frame
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="mx-1 hidden h-6 w-px bg-current-line sm:inline-block" />
              <Button variant="ghost" size="sm" onClick={setIn}>
                <LogIn className="h-4 w-4" />
                Set in
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEnd(round(current))}>
                <LogOut className="h-4 w-4" />
                Set out
              </Button>
              {anchor === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnchor(round(current))}
                  title="Set the replay point to the current frame"
                >
                  <Anchor className="h-4 w-4" />
                  Anchor
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setAnchor(null)}>
                  <Anchor className="h-4 w-4" />
                  Clear anchor
                </Button>
              )}
              {crop === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const w = Math.min(200 / meta.width, 1);
                    const h = Math.min(200 / meta.height, 1);
                    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
                  }}
                  title="Add a centered crop window"
                >
                  <CropIcon className="h-4 w-4" />
                  Crop
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setCrop(null)}>
                  <CropIcon className="h-4 w-4" />
                  Clear crop
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-comment">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} className="accent-purple" />
                Audio
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoReplay} onChange={(e) => setAutoReplay(e.target.checked)} className="accent-purple" />
                Replay on trim
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pauseOnSeek} onChange={(e) => setPauseOnSeek(e.target.checked)} className="accent-purple" />
                Pause on click
              </label>
            </div>
          </div>

          <Timeline
            duration={meta.duration}
            current={current}
            start={start}
            end={end}
            anchor={anchor}
            onAnchor={(t) => setAnchor(round(t))}
            onSeek={seek}
            onStart={setStart}
            onEnd={setEnd}
            onCommit={onTrimCommit}
            thumbFor={thumbFor}
          />

          <p className="text-xs text-comment">
            Drag on the video to crop. Drag the purple handles to trim; use the
            zoom buttons and the Frame steppers to land on an exact frame, then
            Set in / Set out. Keys: Space play/pause, ←/→ step a frame.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Controls
            values={controls}
            onChange={(patch) => setControls((prev) => ({ ...prev, ...patch }))}
            filterPresets={filterPresets}
            onSaveFilterPreset={saveFilterPreset}
            onLoadFilterPreset={loadFilterPreset}
            onRenameFilterPreset={renameFilterPreset}
            onRemoveFilterPreset={removeFilterPreset}
          />
          <TextControls
            layers={texts}
            selectedId={selectedTextId}
            onSelect={setSelectedTextId}
            onAdd={addText}
            onChange={changeText}
            onRemove={removeText}
            presets={textPresets}
            onSavePreset={saveTextPreset}
            onLoadPreset={loadTextPreset}
            onRenamePreset={renameTextPreset}
            onRemovePreset={removeTextPreset}
          />
          <p className="text-sm text-comment">
            {controls.format.toUpperCase()} length:{" "}
            <span className="text-foreground">{(end - start).toFixed(1)}s</span>
          </p>
          <EstimateButton params={params} />
          <ExportButton params={params} />
        </div>
      </div>
    </div>
  );
};
