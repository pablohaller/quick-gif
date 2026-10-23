"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { DirectoryPicker } from "@/components/ui/directory-picker";
import { Field } from "@easy-gif/ui/field";
import { PresetRow } from "@easy-gif/ui/preset-row";
import { ToggleRow, inputCls, selectCls } from "@easy-gif/ui/toggle-row";
import {
  EXAMPLE_SETTINGS,
  FIELD_DEFAULTS,
  fetchSettings,
  parseSettings,
  putSettings,
  type Settings,
} from "@/lib/settings";
import type {
  ColorFilter,
  ColorFilterMode,
  FilterPreset,
  OutputFormat,
  TextPreset,
} from "@/lib/types";

type Toggle<T> = { enabled: boolean; value: T };
type FolderKey = "watchDir" | "outputDir";

type FormModel = {
  watchDir: string;
  outputDir: string;
  dedup: boolean;
  cacheEnabled: boolean;
  format: OutputFormat;
  naming: string;
  width: Toggle<number>;
  height: Toggle<number>;
  fps: Toggle<number>;
  size: { enabled: boolean; value: number; autoDownscale: boolean };
  filter: { enabled: boolean; value: ColorFilter };
  textPresets: TextPreset[];
  filterPresets: FilterPreset[];
};

const toForm = (s: Settings): FormModel => ({
  watchDir: s.watchDir,
  outputDir: s.outputDir,
  dedup: s.dedup,
  cacheEnabled: s.cacheEnabled,
  format: s.format,
  naming: s.naming,
  width: { enabled: s.width !== undefined, value: s.width ?? FIELD_DEFAULTS.width },
  height: { enabled: s.height !== undefined, value: s.height ?? FIELD_DEFAULTS.height },
  fps: { enabled: s.fps !== undefined, value: s.fps ?? FIELD_DEFAULTS.fps },
  size: {
    enabled: s.maxSizeMB !== undefined,
    value: s.maxSizeMB ?? FIELD_DEFAULTS.maxSizeMB,
    autoDownscale: s.autoDownscale ?? FIELD_DEFAULTS.autoDownscale,
  },
  filter: { enabled: s.filter !== undefined, value: s.filter ?? { ...FIELD_DEFAULTS.filter } },
  textPresets: s.textPresets ?? [],
  filterPresets: s.filterPresets ?? [],
});

const fromForm = (f: FormModel): Settings => ({
  watchDir: f.watchDir,
  outputDir: f.outputDir,
  dedup: f.dedup,
  cacheEnabled: f.cacheEnabled,
  format: f.format,
  naming: f.naming,
  ...(f.width.enabled ? { width: f.width.value } : {}),
  ...(f.height.enabled ? { height: f.height.value } : {}),
  ...(f.fps.enabled ? { fps: f.fps.value } : {}),
  ...(f.size.enabled ? { maxSizeMB: f.size.value, autoDownscale: f.size.autoDownscale } : {}),
  ...(f.filter.enabled ? { filter: f.filter.value } : {}),
  ...(f.textPresets.length ? { textPresets: f.textPresets } : {}),
  ...(f.filterPresets.length ? { filterPresets: f.filterPresets } : {}),
});

export const Form = () => {
  const [form, setForm] = useState<FormModel>(() => toForm(EXAMPLE_SETTINGS));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [picking, setPicking] = useState<FolderKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchSettings().then((s) => setForm(toForm(s)));
  }, []);

  const set = <K extends keyof FormModel>(key: K, value: FormModel[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    try {
      await putSettings(fromForm(form));
      setStatus({ ok: true, msg: "Saved" });
    } catch {
      setStatus({ ok: false, msg: "Failed to save" });
    }
  };

  const download = (data: Settings, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = parseSettings(JSON.parse(await file.text()));
      setForm(toForm(parsed));
      await putSettings(parsed);
      setStatus({ ok: true, msg: "Imported & saved" });
    } catch {
      setStatus({ ok: false, msg: "That file isn't a valid settings JSON" });
    }
  };

  const folderRow = (key: FolderKey, label: string, hint: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-comment">{label}</span>
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate rounded border border-comment bg-background px-3 py-2 text-sm text-cyan">
          {form[key] || "—"}
        </span>
        <Button variant="ghost" onClick={() => setPicking(key)}>
          Browse…
        </Button>
      </div>
      <span className="text-xs text-comment">{hint}</span>
    </div>
  );

  return (
    <div className="flex max-w-xl flex-col gap-5">
      {folderRow("watchDir", "Watch folder", "Scanned for videos on the home page.")}
      {folderRow("outputDir", "Output folder", "Where exported GIFs/WebPs are written.")}

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.dedup} onChange={(e) => set("dedup", e.target.checked)} className="accent-purple" />
        <span>Skip duplicate exports (by content hash)</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.cacheEnabled} onChange={(e) => set("cacheEnabled", e.target.checked)} className="accent-purple" />
        <span>Cache poster frames &amp; metadata to disk</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-comment">Default output format</span>
        <select value={form.format} onChange={(e) => set("format", e.target.value as OutputFormat)} className={selectCls}>
          <option value="gif">GIF</option>
          <option value="webp">WebP (animated)</option>
        </select>
      </label>

      <ToggleRow label="Max width (px)" enabled={form.width.enabled} onToggle={(enabled) => set("width", { ...form.width, enabled })}>
        <input type="number" min="0" disabled={!form.width.enabled} value={form.width.value} onChange={(e) => set("width", { ...form.width, value: Number(e.target.value) })} className={`${inputCls} w-32`} />
      </ToggleRow>
      <ToggleRow label="Max height (px)" enabled={form.height.enabled} onToggle={(enabled) => set("height", { ...form.height, enabled })}>
        <input type="number" min="0" disabled={!form.height.enabled} value={form.height.value} onChange={(e) => set("height", { ...form.height, value: Number(e.target.value) })} className={`${inputCls} w-32`} />
      </ToggleRow>
      <ToggleRow label="FPS" enabled={form.fps.enabled} onToggle={(enabled) => set("fps", { ...form.fps, enabled })}>
        <input type="number" min="1" disabled={!form.fps.enabled} value={form.fps.value} onChange={(e) => set("fps", { ...form.fps, value: Number(e.target.value) })} className={`${inputCls} w-32`} />
      </ToggleRow>

      <ToggleRow label="Limit file size (MB)" enabled={form.size.enabled} onToggle={(enabled) => set("size", { ...form.size, enabled })}>
        <input type="number" min="0.1" step="0.1" disabled={!form.size.enabled} value={form.size.value} onChange={(e) => set("size", { ...form.size, value: Number(e.target.value) })} className={`${inputCls} w-32`} />
      </ToggleRow>
      <label className="-mt-2 flex items-center gap-2">
        <input type="checkbox" disabled={!form.size.enabled} checked={form.size.autoDownscale} onChange={(e) => set("size", { ...form.size, autoDownscale: e.target.checked })} className="accent-purple disabled:opacity-50" />
        <span className={form.size.enabled ? "" : "text-comment"}>Auto-downscale when over budget</span>
      </label>

      <ToggleRow label="Default color filter" enabled={form.filter.enabled} onToggle={(enabled) => set("filter", { ...form.filter, enabled })}>
        <div className="flex items-center gap-2">
          <select
            disabled={!form.filter.enabled}
            value={form.filter.value.mode}
            onChange={(e) => set("filter", { ...form.filter, value: { ...form.filter.value, mode: e.target.value as ColorFilterMode } })}
            className={`${selectCls} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="multiply">Color — Multiply</option>
            <option value="screen">Color — Screen</option>
          </select>
          {form.filter.value.mode === "multiply" || form.filter.value.mode === "screen" ? (
            <input type="color" disabled={!form.filter.enabled} value={form.filter.value.color || "#ffffff"} onChange={(e) => set("filter", { ...form.filter, value: { ...form.filter.value, color: e.target.value } })} className="h-9 w-10 cursor-pointer rounded border border-comment bg-background disabled:opacity-50" />
          ) : null}
        </div>
      </ToggleRow>

      {form.textPresets.length || form.filterPresets.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-comment">Saved presets</span>
          {form.textPresets.map((p) => (
            <PresetRow
              key={p.id}
              name={p.name ?? p.text}
              placeholder={p.text || "Text"}
              leading={<span className="h-4 w-4 shrink-0 rounded-full border border-background" style={{ backgroundColor: p.color }} />}
              onRename={(name) => set("textPresets", form.textPresets.map((x) => (x.id === p.id ? { ...x, name } : x)))}
              onRemove={() => set("textPresets", form.textPresets.filter((x) => x.id !== p.id))}
            />
          ))}
          {form.filterPresets.map((p) => (
            <PresetRow
              key={p.id}
              name={p.name ?? p.mode}
              placeholder={p.mode}
              leading={<span className="h-4 w-4 shrink-0 rounded-full border border-background" style={{ backgroundColor: p.mode === "grayscale" ? "#888888" : p.color }} />}
              onRename={(name) => set("filterPresets", form.filterPresets.map((x) => (x.id === p.id ? { ...x, name } : x)))}
              onRemove={() => set("filterPresets", form.filterPresets.filter((x) => x.id !== p.id))}
            />
          ))}
        </div>
      ) : null}

      <Field label="Naming template" value={form.naming} onChange={(e) => set("naming", e.target.value)} hint="Tokens: {timestamp}, {stem}, {n}. Default: giffer_{timestamp}" />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save}>Save settings</Button>
        {status ? <span className={status.ok ? "text-green" : "text-red"}>{status.msg}</span> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-current-line bg-current-line p-4">
        <span className="font-semibold">Import / export</span>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={() => download(fromForm(form), "quick-gif-settings.json")}>
            <Download className="h-4 w-4" />
            Export current
          </Button>
          <Button variant="ghost" size="sm" onClick={() => download(EXAMPLE_SETTINGS, "quick-gif-settings.example.json")}>
            <Download className="h-4 w-4" />
            Download example
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import JSON
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importJson(file); e.target.value = ""; }} />
        </div>
      </div>

      <DirectoryPicker
        open={picking !== null}
        initialPath={picking ? form[picking] : ""}
        onSelect={(p) => {
          if (picking) set(picking, p);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </div>
  );
};
