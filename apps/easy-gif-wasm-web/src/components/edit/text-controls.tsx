"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { Accordion } from "@easy-gif/ui/accordion";
import { Button } from "@easy-gif/ui/button";
import { PresetRow } from "@easy-gif/ui/preset-row";
import { inputCls } from "@easy-gif/ui/toggle-row";
import type { TextLayer, TextPreset } from "@/lib/types";

type Props = {
  layers: TextLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<TextLayer>) => void;
  onRemove: (id: string) => void;
  presets: TextPreset[];
  onSavePreset: (layer: TextLayer) => void;
  onLoadPreset: (preset: TextPreset) => void;
  onRenamePreset: (id: string, name: string) => void;
  onRemovePreset: (id: string) => void;
};

export const TextControls = ({
  layers,
  selectedId,
  onSelect,
  onAdd,
  onChange,
  onRemove,
  presets,
  onSavePreset,
  onLoadPreset,
  onRenamePreset,
  onRemovePreset,
}: Props) => (
  <Accordion
    title="Text"
    summary={layers.length ? `${layers.length} layer${layers.length > 1 ? "s" : ""}` : "none"}
  >
    {layers.length === 0 ? (
      <p className="text-xs text-comment">
        Add text that burns into the GIF. Drag it on the video to position it.
      </p>
    ) : null}

    {layers.map((layer) => (
      <div
        key={layer.id}
        onPointerDown={() => onSelect(layer.id)}
        className={`flex flex-col gap-2 rounded border p-2 ${
          selectedId === layer.id ? "border-cyan" : "border-comment/40"
        }`}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={layer.text}
            placeholder="Text"
            onChange={(e) => onChange(layer.id, { text: e.target.value })}
            className={`${inputCls} min-w-0 flex-1`}
          />
          <button
            type="button"
            aria-label="Save as preset"
            title="Save as preset"
            onClick={() => onSavePreset(layer)}
            className="rounded border border-comment px-2 text-comment hover:bg-current-line hover:text-cyan"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete text layer"
            onClick={() => onRemove(layer.id)}
            className="rounded border border-comment px-2 text-comment hover:bg-current-line hover:text-red"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-comment">
          <label className="flex items-center gap-2">
            Size
            <input
              type="range"
              min={2}
              max={20}
              value={Math.round(layer.size * 100)}
              onChange={(e) => onChange(layer.id, { size: Number(e.target.value) / 100 })}
              className="accent-purple"
            />
          </label>
          <label className="flex items-center gap-2">
            Color
            <input
              type="color"
              value={layer.color || "#ffffff"}
              onChange={(e) => onChange(layer.id, { color: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-comment bg-background"
            />
          </label>
          <label className="flex items-center gap-2">
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.opacity * 100)}
              onChange={(e) => onChange(layer.id, { opacity: Number(e.target.value) / 100 })}
              className="accent-purple"
            />
          </label>
        </div>
      </div>
    ))}

    {presets.length ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-comment">
          Presets — Add to place, pencil to rename
        </span>
        {presets.map((preset) => (
          <PresetRow
            key={preset.id}
            name={preset.name ?? preset.text}
            placeholder={preset.text || "Text"}
            leading={
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-background"
                style={{ backgroundColor: preset.color }}
              />
            }
            applyLabel="Add"
            onApply={() => onLoadPreset(preset)}
            onRename={(name) => onRenamePreset(preset.id, name)}
            onRemove={() => onRemovePreset(preset.id)}
          />
        ))}
      </div>
    ) : null}

    <Button variant="ghost" size="sm" onClick={onAdd}>
      <Plus className="h-4 w-4" />
      Add text layer
    </Button>
  </Accordion>
);
