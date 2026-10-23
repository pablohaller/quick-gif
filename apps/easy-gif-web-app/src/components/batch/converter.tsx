"use client";

import { useState } from "react";
import { Controls, type ControlValues } from "@/components/edit/controls";
import { Button } from "@easy-gif/ui/button";
import { FIELD_DEFAULTS, type Settings } from "@/lib/settings";
import type { ExportParams, ExportResult, VideoMeta } from "@/lib/types";

type Props = { videos: VideoMeta[]; settings: Settings };

type Status =
  | { state: "idle" }
  | { state: "rendering" }
  | { state: "done"; result: ExportResult }
  | { state: "error"; error: string };

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export const Converter = ({ videos, settings }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(videos.map((v) => v.name)),
  );
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);
  const [controls, setControls] = useState<ControlValues>({
    format: settings.format,
    width: { enabled: settings.width !== undefined, value: settings.width ?? FIELD_DEFAULTS.width },
    height: { enabled: settings.height !== undefined, value: settings.height ?? FIELD_DEFAULTS.height },
    fps: { enabled: settings.fps !== undefined, value: settings.fps ?? FIELD_DEFAULTS.fps },
    size: {
      enabled: settings.maxSizeMB !== undefined,
      value: settings.maxSizeMB ?? FIELD_DEFAULTS.maxSizeMB,
      autoDownscale: settings.autoDownscale ?? FIELD_DEFAULTS.autoDownscale,
    },
    filter: settings.filter ?? { ...FIELD_DEFAULTS.filter },
  });

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const allSelected = selected.size === videos.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(videos.map((v) => v.name)));

  // Render each selected video sequentially (full clip, no crop/trim/text).
  const convert = async () => {
    setBusy(true);
    const names = videos.map((v) => v.name).filter((n) => selected.has(n));
    setStatus((prev) => {
      const next = { ...prev };
      for (const name of names) next[name] = { state: "rendering" };
      return next;
    });

    for (const name of names) {
      const params: ExportParams = {
        name,
        start: null,
        end: null,
        crop: null,
        texts: [],
        format: controls.format,
        fps: controls.fps.enabled ? controls.fps.value : undefined,
        width: controls.width.enabled ? controls.width.value : undefined,
        height: controls.height.enabled ? controls.height.value : undefined,
        filter: controls.filter,
        maxSizeMB: controls.size.enabled ? controls.size.value : 0,
        autoDownscale: controls.size.enabled ? controls.size.autoDownscale : false,
        source: "watch",
      };
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const body = await res.json();
        if (!res.ok) {
          setStatus((prev) => ({ ...prev, [name]: { state: "error", error: body.error ?? "Export failed" } }));
        } else {
          setStatus((prev) => ({ ...prev, [name]: { state: "done", result: body.data as ExportResult } }));
        }
      } catch (e) {
        setStatus((prev) => ({
          ...prev,
          [name]: { state: "error", error: e instanceof Error ? e.message : "Export failed" },
        }));
      }
    }

    setBusy(false);
  };

  const label = controls.format.toUpperCase();
  const done = videos.filter((v) => status[v.name]?.state === "done").length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={toggleAll} className="text-sm text-cyan hover:underline">
            {allSelected ? "Clear all" : "Select all"}
          </button>
          <span className="text-sm text-comment">
            {selected.size} of {videos.length} selected{done > 0 ? ` · ${done} done` : ""}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {videos.map((video) => {
            const s = status[video.name];
            return (
              <li key={video.name} className="flex items-center gap-3 rounded-lg border border-current-line bg-current-line p-3">
                <input type="checkbox" checked={selected.has(video.name)} disabled={busy} onChange={() => toggle(video.name)} className="accent-purple" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/thumb?name=${encodeURIComponent(video.name)}&source=watch&v=${video.modifiedAt}`}
                  alt={video.name}
                  className="h-12 w-20 shrink-0 rounded bg-background object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{video.name}</p>
                  <p className="text-xs text-comment">{video.width}×{video.height} · {Math.round(video.fps)} fps</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  {s?.state === "rendering" ? (
                    <span className="text-orange">Rendering…</span>
                  ) : s?.state === "done" ? (
                    <span className="text-green">
                      {s.result.deduped ? "Exists" : "Saved"} · {formatSize(s.result.sizeBytes)}
                      <br />
                      <span className="text-comment">{s.result.file}</span>
                    </span>
                  ) : s?.state === "error" ? (
                    <span className="text-red">{s.error}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <Controls
          values={controls}
          onChange={(patch) => setControls((prev) => ({ ...prev, ...patch }))}
          filterPresets={[]}
          onSaveFilterPreset={() => {}}
          onLoadFilterPreset={() => {}}
          onRenameFilterPreset={() => {}}
          onRemoveFilterPreset={() => {}}
        />
        <Button onClick={convert} disabled={busy || selected.size === 0}>
          {busy ? "Converting…" : `Convert ${selected.size} to ${label}`}
        </Button>
        <p className="text-xs text-comment">
          Files are rendered one at a time into the output folder. Nothing in the
          output folder is deleted.
        </p>
      </div>
    </div>
  );
};
