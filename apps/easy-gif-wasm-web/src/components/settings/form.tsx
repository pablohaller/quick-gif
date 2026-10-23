"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@easy-gif/ui/button";
import { Field } from "@easy-gif/ui/field";
import { PresetRow } from "@easy-gif/ui/preset-row";
import { ToggleRow, inputCls, selectCls } from "@easy-gif/ui/toggle-row";
import {
  EXAMPLE_SETTINGS,
  FIELD_DEFAULTS,
  loadSettings,
  parseSettings,
  saveSettings,
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

// Editable form model: every field is present with an `enabled` flag; only
// enabled ones are serialised back into the (partial) Settings.
type FormModel = {
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
  filter: {
    enabled: s.filter !== undefined,
    value: s.filter ?? { ...FIELD_DEFAULTS.filter },
  },
  textPresets: s.textPresets ?? [],
  filterPresets: s.filterPresets ?? [],
});

const fromForm = (f: FormModel): Settings => ({
  format: f.format,
  naming: f.naming,
  ...(f.width.enabled ? { width: f.width.value } : {}),
  ...(f.height.enabled ? { height: f.height.value } : {}),
  ...(f.fps.enabled ? { fps: f.fps.value } : {}),
  ...(f.size.enabled
    ? { maxSizeMB: f.size.value, autoDownscale: f.size.autoDownscale }
    : {}),
  ...(f.filter.enabled ? { filter: f.filter.value } : {}),
  ...(f.textPresets.length ? { textPresets: f.textPresets } : {}),
  ...(f.filterPresets.length ? { filterPresets: f.filterPresets } : {}),
});

export const Form = () => {
  const [form, setForm] = useState<FormModel>(() => toForm(EXAMPLE_SETTINGS));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(toForm(loadSettings()));
  }, []);

  const set = <K extends keyof FormModel>(key: K, value: FormModel[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    try {
      saveSettings(fromForm(form));
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
      saveSettings(parsed);
      setStatus({ ok: true, msg: "Imported & saved" });
    } catch {
      setStatus({ ok: false, msg: "That file isn't a valid settings JSON" });
    }
  };

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <p className="text-sm text-comment">
        These are your defaults. In the Studio, an enabled field here starts
        turned on; disabled fields start off (and can be toggled per creation
        without changing these defaults).
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-comment">Default output format</span>
        <select
          value={form.format}
          onChange={(e) => set("format", e.target.value as OutputFormat)}
          className={selectCls}
        >
          <option value="gif">GIF</option>
          <option value="webp">WebP (animated)</option>
        </select>
      </label>

      <ToggleRow
        label="Max width (px)"
        enabled={form.width.enabled}
        onToggle={(enabled) => set("width", { ...form.width, enabled })}
      >
        <input
          type="number"
          min="2"
          disabled={!form.width.enabled}
          value={form.width.value}
          onChange={(e) => set("width", { ...form.width, value: Number(e.target.value) })}
          className={`${inputCls} w-32`}
        />
      </ToggleRow>

      <ToggleRow
        label="Max height (px)"
        enabled={form.height.enabled}
        onToggle={(enabled) => set("height", { ...form.height, enabled })}
      >
        <input
          type="number"
          min="2"
          disabled={!form.height.enabled}
          value={form.height.value}
          onChange={(e) => set("height", { ...form.height, value: Number(e.target.value) })}
          className={`${inputCls} w-32`}
        />
      </ToggleRow>

      <ToggleRow
        label="FPS"
        enabled={form.fps.enabled}
        onToggle={(enabled) => set("fps", { ...form.fps, enabled })}
      >
        <input
          type="number"
          min="1"
          disabled={!form.fps.enabled}
          value={form.fps.value}
          onChange={(e) => set("fps", { ...form.fps, value: Number(e.target.value) })}
          className={`${inputCls} w-32`}
        />
      </ToggleRow>

      <ToggleRow
        label="Limit file size (MB)"
        enabled={form.size.enabled}
        onToggle={(enabled) => set("size", { ...form.size, enabled })}
      >
        <input
          type="number"
          min="0.1"
          step="0.1"
          disabled={!form.size.enabled}
          value={form.size.value}
          onChange={(e) => set("size", { ...form.size, value: Number(e.target.value) })}
          className={`${inputCls} w-32`}
        />
      </ToggleRow>
      <label className="-mt-2 flex items-center gap-2">
        <input
          type="checkbox"
          disabled={!form.size.enabled}
          checked={form.size.autoDownscale}
          onChange={(e) => set("size", { ...form.size, autoDownscale: e.target.checked })}
          className="accent-purple disabled:opacity-50"
        />
        <span className={form.size.enabled ? "" : "text-comment"}>
          Auto-downscale when over the size budget
        </span>
      </label>

      <ToggleRow
        label="Default color filter"
        enabled={form.filter.enabled}
        onToggle={(enabled) => set("filter", { ...form.filter, enabled })}
      >
        <div className="flex items-center gap-2">
          <select
            disabled={!form.filter.enabled}
            value={form.filter.value.mode}
            onChange={(e) =>
              set("filter", {
                ...form.filter,
                value: { ...form.filter.value, mode: e.target.value as ColorFilterMode },
              })
            }
            className={`${selectCls} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="multiply">Color — Multiply</option>
            <option value="screen">Color — Screen</option>
          </select>
          {form.filter.value.mode === "multiply" || form.filter.value.mode === "screen" ? (
            <input
              type="color"
              disabled={!form.filter.enabled}
              value={form.filter.value.color || "#ffffff"}
              onChange={(e) =>
                set("filter", {
                  ...form.filter,
                  value: { ...form.filter.value, color: e.target.value },
                })
              }
              className="h-9 w-10 cursor-pointer rounded border border-comment bg-background disabled:opacity-50"
            />
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
              leading={
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-background"
                  style={{ backgroundColor: p.color }}
                />
              }
              onRename={(name) =>
                set(
                  "textPresets",
                  form.textPresets.map((x) => (x.id === p.id ? { ...x, name } : x)),
                )
              }
              onRemove={() =>
                set("textPresets", form.textPresets.filter((x) => x.id !== p.id))
              }
            />
          ))}
          {form.filterPresets.map((p) => (
            <PresetRow
              key={p.id}
              name={p.name ?? p.mode}
              placeholder={p.mode}
              leading={
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-background"
                  style={{ backgroundColor: p.mode === "grayscale" ? "#888888" : p.color }}
                />
              }
              onRename={(name) =>
                set(
                  "filterPresets",
                  form.filterPresets.map((x) => (x.id === p.id ? { ...x, name } : x)),
                )
              }
              onRemove={() =>
                set("filterPresets", form.filterPresets.filter((x) => x.id !== p.id))
              }
            />
          ))}
          <span className="text-xs text-comment">
            Presets are created in the Studio. Changes here apply on Save.
          </span>
        </div>
      ) : null}

      <Field
        label="Naming template"
        value={form.naming}
        onChange={(e) => set("naming", e.target.value)}
        hint="Download filename tokens: {timestamp} (keeps each export unique) and {stem} (source filename)."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save}>Save settings</Button>
        {status ? (
          <span className={status.ok ? "text-green" : "text-red"}>{status.msg}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-current-line bg-current-line p-4">
        <span className="font-semibold">Import / export</span>
        <p className="text-sm text-comment">
          A settings JSON only lists the fields you want on — any omitted key stays
          disabled. Importing replaces these defaults.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => download(fromForm(form), "quick-gif-settings.json")}
          >
            <Download className="h-4 w-4" />
            Export current
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => download(EXAMPLE_SETTINGS, "quick-gif-settings.example.json")}
          >
            <Download className="h-4 w-4" />
            Download example
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = "";
            }}
          />
        </div>
        <pre className="overflow-x-auto rounded bg-background p-3 text-xs text-comment">
          {JSON.stringify(EXAMPLE_SETTINGS, null, 2)}
        </pre>
      </div>
    </div>
  );
};
