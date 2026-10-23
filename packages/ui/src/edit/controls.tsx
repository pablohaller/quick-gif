"use client";

import { Save } from "lucide-react";
import { Accordion } from "../accordion";
import { Button } from "../button";
import { PresetRow } from "../preset-row";
import { ToggleRow, inputCls, selectCls } from "../toggle-row";
import type {
  ColorFilter,
  ColorFilterMode,
  FilterPreset,
  OutputFormat,
} from "@easy-gif/core";

type Toggle<T> = { enabled: boolean; value: T };

export type ControlValues = {
  format: OutputFormat;
  width: Toggle<number>; // max width
  height: Toggle<number>; // max height
  fps: Toggle<number>;
  size: { enabled: boolean; value: number; autoDownscale: boolean };
  filter: ColorFilter;
};

const FILTER_LABELS: Record<ColorFilterMode, string> = {
  none: "none",
  grayscale: "grayscale",
  multiply: "multiply",
  screen: "screen",
};

type Props = {
  values: ControlValues;
  onChange: (patch: Partial<ControlValues>) => void;
  filterPresets: FilterPreset[];
  onSaveFilterPreset: () => void;
  onLoadFilterPreset: (preset: FilterPreset) => void;
  onRenameFilterPreset: (id: string, name: string) => void;
  onRemoveFilterPreset: (id: string) => void;
};

export const Controls = ({
  values,
  onChange,
  filterPresets,
  onSaveFilterPreset,
  onLoadFilterPreset,
  onRenameFilterPreset,
  onRemoveFilterPreset,
}: Props) => {
  const dimLabel = (t: Toggle<number>) => (t.enabled && t.value ? `${t.value}` : "auto");
  const dimsSummary =
    (values.width.enabled && values.width.value) ||
    (values.height.enabled && values.height.value)
      ? `${dimLabel(values.width)}×${dimLabel(values.height)}`
      : "source size";

  return (
    <div className="flex flex-col gap-3">
      <Accordion title="Output format" summary={values.format.toUpperCase()}>
        <select
          value={values.format}
          onChange={(e) => onChange({ format: e.target.value as OutputFormat })}
          className={selectCls}
        >
          <option value="gif">GIF</option>
          <option value="webp">WebP (animated)</option>
        </select>
      </Accordion>

      <Accordion title="Dimensions" summary={dimsSummary}>
        <ToggleRow
          label="Max width (px)"
          enabled={values.width.enabled}
          onToggle={(enabled) => onChange({ width: { ...values.width, enabled } })}
        >
          <input
            type="number"
            min="0"
            disabled={!values.width.enabled}
            value={values.width.value}
            onChange={(e) =>
              onChange({ width: { ...values.width, value: Number(e.target.value) } })
            }
            className={`${inputCls} w-32`}
          />
        </ToggleRow>
        <ToggleRow
          label="Max height (px)"
          enabled={values.height.enabled}
          onToggle={(enabled) => onChange({ height: { ...values.height, enabled } })}
        >
          <input
            type="number"
            min="0"
            disabled={!values.height.enabled}
            value={values.height.value}
            onChange={(e) =>
              onChange({ height: { ...values.height, value: Number(e.target.value) } })
            }
            className={`${inputCls} w-32`}
          />
        </ToggleRow>
        <p className="text-xs text-comment">
          Aspect ratio is preserved and the source is never upscaled. 0 (or both
          disabled) keeps the original size.
        </p>
      </Accordion>

      <Accordion title="Frame rate" summary={values.fps.enabled ? `${values.fps.value} fps` : "source"}>
        <ToggleRow
          label="FPS"
          enabled={values.fps.enabled}
          onToggle={(enabled) => onChange({ fps: { ...values.fps, enabled } })}
        >
          <input
            type="number"
            min="1"
            disabled={!values.fps.enabled}
            value={values.fps.value}
            onChange={(e) =>
              onChange({ fps: { ...values.fps, value: Number(e.target.value) } })
            }
            className={`${inputCls} w-32`}
          />
        </ToggleRow>
        <p className="text-xs text-comment">
          Disable to keep the source frame rate.
        </p>
      </Accordion>

      <Accordion title="Color filter" summary={FILTER_LABELS[values.filter.mode]}>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-comment">Mode</span>
          <select
            value={values.filter.mode}
            onChange={(e) =>
              onChange({
                filter: { ...values.filter, mode: e.target.value as ColorFilterMode },
              })
            }
            className={selectCls}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="multiply">Color — Multiply</option>
            <option value="screen">Color — Screen</option>
          </select>
        </label>

        {values.filter.mode === "multiply" || values.filter.mode === "screen" ? (
          <label className="flex items-center gap-2 text-sm text-comment">
            Tint color
            <input
              type="color"
              value={values.filter.color || "#ffffff"}
              onChange={(e) =>
                onChange({ filter: { ...values.filter, color: e.target.value } })
              }
              className="h-7 w-10 cursor-pointer rounded border border-comment bg-background"
            />
          </label>
        ) : null}

        <p className="text-xs text-comment">
          Multiply darkens toward the colour (good for warm/cool tints); Screen
          lightens toward it.
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveFilterPreset}
          disabled={values.filter.mode === "none"}
        >
          <Save className="h-4 w-4" />
          Save as preset
        </Button>

        {filterPresets.length ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-comment">
              Presets — Apply to use, pencil to rename
            </span>
            {filterPresets.map((preset) => (
              <PresetRow
                key={preset.id}
                name={preset.name ?? FILTER_LABELS[preset.mode]}
                placeholder={FILTER_LABELS[preset.mode]}
                leading={
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-background"
                    title={FILTER_LABELS[preset.mode]}
                    style={{
                      backgroundColor:
                        preset.mode === "grayscale" ? "#888888" : preset.color,
                    }}
                  />
                }
                applyLabel="Apply"
                onApply={() => onLoadFilterPreset(preset)}
                onRename={(name) => onRenameFilterPreset(preset.id, name)}
                onRemove={() => onRemoveFilterPreset(preset.id)}
              />
            ))}
          </div>
        ) : null}
      </Accordion>

      <Accordion
        title="File size"
        summary={values.size.enabled ? `≤ ${values.size.value} MB` : "no limit"}
      >
        <ToggleRow
          label="Limit file size (MB)"
          enabled={values.size.enabled}
          onToggle={(enabled) => onChange({ size: { ...values.size, enabled } })}
        >
          <input
            type="number"
            min="0.1"
            step="0.1"
            disabled={!values.size.enabled}
            value={values.size.value}
            onChange={(e) =>
              onChange({ size: { ...values.size, value: Number(e.target.value) } })
            }
            className={`${inputCls} w-32`}
          />
        </ToggleRow>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!values.size.enabled}
            checked={values.size.autoDownscale}
            onChange={(e) =>
              onChange({ size: { ...values.size, autoDownscale: e.target.checked } })
            }
            className="accent-purple disabled:opacity-50"
          />
          <span className={values.size.enabled ? "" : "text-comment"}>
            Auto-downscale if over budget
          </span>
        </label>
      </Accordion>
    </div>
  );
};
