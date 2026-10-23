"use client";

import type { ReactNode } from "react";

// A checkbox that enables/disables (greys, never hides) the input(s) beside it.
export const ToggleRow = ({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-purple"
      />
      <span className={enabled ? "text-foreground" : "text-comment"}>{label}</span>
    </label>
    {children}
  </div>
);

export const inputCls =
  "rounded border border-comment bg-background px-3 py-2 text-foreground focus:border-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const selectCls =
  "rounded border border-comment bg-background px-3 py-2 focus:border-purple focus:outline-none";
