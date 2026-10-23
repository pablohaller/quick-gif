"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useThumbnails } from "@/components/edit/use-thumbnails";
import { Button } from "@easy-gif/ui/button";
import { useSession } from "@/components/studio/session-context";
import {
  FIELD_DEFAULTS,
  loadSettings,
  savePresets,
  type Settings,
} from "@/lib/settings";
import type {
  CropRect,
  ExportParams,
  FilterPreset,
  TextLayer,
  TextPreset,
  VideoMeta,
} from "@/lib/types";

const round = (n: number) => Math.round(n * 1000) / 1000;

// Build the editor's control values from the saved (partial) settings. A field
// is enabled when its key is present; otherwise it shows a greyed fallback.
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

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Read duration/width/height from an uploaded video via a transient <video>.
// Source fps isn't available in the browser, so it's left at 0 (frame-stepping
// then falls back to 30 fps).
const probeVideo = (file: File, url: string): Promise<VideoMeta> =>
  new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () =>
      resolve({
        name: file.name,
        width: v.videoWidth,
        height: v.videoHeight,
        duration: v.duration,
        fps: 0,
        sizeBytes: file.size,
      });
    v.onerror = () => reject(new Error("Could not read that video"));
  });

export const Studio = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setHasVideo, setResetHandler } = useSession();

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textPresets, setTextPresets] = useState<TextPreset[]>([]);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [autoReplay, setAutoReplay] = useState(true);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  // When on, clicking the timeline pauses on that frame instead of playing on.
  const [pauseOnSeek, setPauseOnSeek] = useState(false);
  // Optional fixed replay point; when set, Replay always starts here even if it
  // sits before the trim in-point.
  const [anchor, setAnchor] = useState<number | null>(null);
  // Guards the loop against re-seeking while a loop-seek is still settling.
  const loopCooldown = useRef(0);

  const [naming, setNaming] = useState("giffer_{timestamp}");
  const [controls, setControls] = useState<ControlValues>({
    format: "gif",
    width: { enabled: true, value: FIELD_DEFAULTS.width },
    height: { enabled: false, value: FIELD_DEFAULTS.height },
    fps: { enabled: true, value: FIELD_DEFAULTS.fps },
    size: { enabled: true, value: FIELD_DEFAULTS.maxSizeMB, autoDownscale: true },
    filter: { ...FIELD_DEFAULTS.filter },
  });

  const thumbFor = useThumbnails(url);

  // Seed controls from saved settings on mount. A field is enabled when its key
  // is present in the stored (partial) settings; otherwise it shows a greyed
  // fallback. This only affects the current creation — never written back.
  useEffect(() => {
    const s = loadSettings();
    setNaming(s.naming);
    setTextPresets(s.textPresets ?? []);
    setFilterPresets(s.filterPresets ?? []);
    setControls(controlsFromSettings(s));
  }, []);

  // Revoke the object URL when it changes or the component unmounts.
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  // React's `muted` prop doesn't reliably update the DOM property, so set it
  // directly (also re-applied whenever a new video loads).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, url]);

  // Track real play/pause state for the toggle button.
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
  }, [url]);

  // Pause when the page is hidden (tab switch, macOS Space swipe, minimise).
  // Backgrounded media can come back "playing" but stalled, which leaves
  // play/pause out of sync; pausing keeps the state consistent on return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const load = async (picked: File) => {
    setLoading(true);
    setError(null);
    const objectUrl = URL.createObjectURL(picked);
    try {
      const probed = await probeVideo(picked, objectUrl);
      setFile(picked);
      setUrl(objectUrl);
      setMeta(probed);
      setCrop(null);
      setTexts([]);
      setSelectedTextId(null);
      setAnchor(null);
      setStart(0);
      setEnd(probed.duration);
      setCurrent(0);
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      setError(e instanceof Error ? e.message : "Could not read that video");
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    setFile(null);
    setUrl(null);
    setMeta(null);
    setError(null);
    // Start the next creation fresh: clear overlays and re-seed controls from
    // the saved defaults (so e.g. a color filter doesn't carry over).
    setCrop(null);
    setTexts([]);
    setSelectedTextId(null);
    setAnchor(null);
    const s = loadSettings();
    setNaming(s.naming);
    setControls(controlsFromSettings(s));
  }, []);

  // Wire the top bar's "New Gif" button to this Studio's reset, and tell it
  // whether there's progress worth warning about.
  useEffect(() => {
    setResetHandler(reset);
    return () => setResetHandler(() => {});
  }, [reset, setResetHandler]);

  useEffect(() => {
    setHasVideo(meta !== null);
    return () => setHasVideo(false);
  }, [meta, setHasVideo]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const picked = e.dataTransfer.files?.[0];
    if (picked) void load(picked);
  };

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

  // --- Presets (persisted to localStorage settings) ---
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
    savePresets(next, filterPresets);
  };

  const renameTextPreset = (id: string, name: string) => {
    const next = textPresets.map((p) => (p.id === id ? { ...p, name } : p));
    setTextPresets(next);
    savePresets(next, filterPresets);
  };

  const loadTextPreset = (preset: TextPreset) => {
    const id = crypto.randomUUID();
    setTexts((prev) => [
      ...prev,
      {
        id,
        text: preset.text,
        x: 0.3,
        y: 0.08,
        size: preset.size,
        color: preset.color,
        opacity: preset.opacity,
      },
    ]);
    setSelectedTextId(id);
  };

  const removeTextPreset = (id: string) => {
    const next = textPresets.filter((p) => p.id !== id);
    setTextPresets(next);
    savePresets(next, filterPresets);
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
    savePresets(textPresets, next);
  };

  const renameFilterPreset = (id: string, name: string) => {
    const next = filterPresets.map((p) => (p.id === id ? { ...p, name } : p));
    setFilterPresets(next);
    savePresets(textPresets, next);
  };

  const loadFilterPreset = (preset: FilterPreset) =>
    setControls((prev) => ({
      ...prev,
      filter: { mode: preset.mode, color: preset.color },
    }));

  const removeFilterPreset = (id: string) => {
    const next = filterPresets.filter((p) => p.id !== id);
    setFilterPresets(next);
    savePresets(textPresets, next);
  };

  // Where Replay / loop-around begins: the anchor if set, otherwise the in-point.
  const replayStart = anchor ?? start;

  // Mirror the time into state; the rAF loop below owns the in/out boundary.
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
      // Rejected when playback is interrupted (e.g. rapid pause/seek); ignore.
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
    // Rejected when playback is interrupted (e.g. rapid pause/seek); ignore.
    void video.play().catch(() => {});
  };

  const stepFrame = (dir: 1 | -1) => {
    const video = videoRef.current;
    if (!video || !meta) return;
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

  // Keyboard shortcuts: Space play/pause, ←/→ step one frame. Ignored while a
  // form field is focused (and Space is left to any focused button).
  useEffect(() => {
    if (!meta) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
      if (e.code === "Space") {
        if (inField) return;
        e.preventDefault();
        // Space is always play/pause; blur any focused button so it doesn't
        // also re-activate (e.g. re-running "Set in").
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
  }, [meta, start, end, anchor]);

  // Precise loop. `timeupdate` only fires ~4x/sec, so the preview overshoots the
  // out-point; detect the boundary (and the anchor lower bound) via rAF instead,
  // so what you see matches the exported clip.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      const now = performance.now();
      // Skip while a seek is in flight (currentTime still reports the old value)
      // and for a short cooldown after one, so we never thrash seeks.
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

  // When the out-point is the very end of the clip, the element fires "ended"
  // (and pauses) before the loop can seek — restart it from the replay point.
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
  }, [replayStart, url]);

  if (!meta || !url || !file) {
    return (
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-20 text-center transition ${
            dragActive
              ? "border-purple bg-purple/10"
              : "border-comment hover:border-purple hover:bg-current-line/40"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 text-purple"
            aria-hidden
          >
            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-foreground">
              {loading ? "Reading video…" : "Drop a video here, or click to browse"}
            </span>
            <span className="text-sm text-comment">
              MP4, WebM, MOV and more — everything runs in your browser, and the
              file never leaves your device.
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.mkv,.m4v,.avi"
            disabled={loading}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void load(picked);
            }}
            className="hidden"
          />
        </div>
        {error ? <span className="text-sm text-red">{error}</span> : null}
      </div>
    );
  }

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
  };

  return (
    <div>
      <p className="mb-2 truncate text-sm text-comment">
        <span className="font-medium text-foreground">{meta.name}</span>
        {"  ·  "}
        {meta.width}×{meta.height} · {meta.duration.toFixed(1)}s ·{" "}
        {formatBytes(meta.sizeBytes)}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <Player
            ref={videoRef}
            meta={meta}
            src={url}
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
            {/* Actions — kept on one row */}
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
                    // Centered 200x200 window (clamped to the source size).
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

            {/* Options */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-comment">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!muted}
                  onChange={(e) => setMuted(!e.target.checked)}
                  className="accent-purple"
                />
                Audio
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoReplay}
                  onChange={(e) => setAutoReplay(e.target.checked)}
                  className="accent-purple"
                />
                Replay on trim
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pauseOnSeek}
                  onChange={(e) => setPauseOnSeek(e.target.checked)}
                  className="accent-purple"
                />
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
            Set in / Set out. Keys: Space play/pause, ←/→ step a frame. Drop an
            Anchor to always replay from that point.
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
          <EstimateButton file={file} meta={meta} params={params} />
          <ExportButton file={file} meta={meta} params={params} naming={naming} />
        </div>
      </div>
    </div>
  );
};
