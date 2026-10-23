"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";

type Props = {
  name: string;
  placeholder: string;
  // A small leading element (e.g. a color swatch).
  leading?: ReactNode;
  // Apply/add action; omit (e.g. in Settings) to hide the button.
  applyLabel?: string;
  onApply?: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
};

// One preset: shows its name with an edit (pencil) toggle that reveals an inline
// name field. Used for text and filter presets, in the Studio and in Settings.
export const PresetRow = ({
  name,
  placeholder,
  leading,
  applyLabel,
  onApply,
  onRename,
  onRemove,
}: Props) => {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {leading}
      {editing ? (
        <input
          autoFocus
          type="text"
          value={name}
          placeholder={placeholder}
          onChange={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded border border-comment bg-background px-2 py-1 text-xs text-foreground focus:border-purple focus:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs" title={name || placeholder}>
          {name || placeholder}
        </span>
      )}

      {editing ? (
        <button
          type="button"
          aria-label="Done"
          onClick={() => setEditing(false)}
          className="shrink-0 text-comment hover:text-green"
        >
          <Check className="h-4 w-4" />
        </button>
      ) : (
        <>
          {onApply ? (
            <button
              type="button"
              onClick={onApply}
              className="shrink-0 rounded border border-comment px-2 py-1 text-xs hover:bg-current-line hover:text-cyan"
            >
              {applyLabel}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Rename"
            onClick={() => setEditing(true)}
            className="shrink-0 text-comment hover:text-cyan"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </>
      )}

      <button
        type="button"
        aria-label="Delete preset"
        onClick={onRemove}
        className="shrink-0 text-comment hover:text-red"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
