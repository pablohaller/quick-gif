"use client";

import { useEffect, useState } from "react";

export type SortMode = "recent" | "name";

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "name", label: "Name (A–Z)" },
];

// Persisted per-list sort preference. Starts from the default so the server-
// rendered markup and first client render agree (localStorage is read after
// mount to avoid a hydration mismatch).
export const useSortMode = (storageKey: string, fallback: SortMode = "recent") => {
  const [mode, setMode] = useState<SortMode>(fallback);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "recent" || saved === "name") setMode(saved);
  }, [storageKey]);

  const update = (next: SortMode) => {
    setMode(next);
    localStorage.setItem(storageKey, next);
  };

  return [mode, update] as const;
};

export const SortSelect = ({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}) => (
  <label className="flex items-center gap-2 text-xs text-comment">
    <span>Sort</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortMode)}
      className="rounded border border-comment bg-current-line px-2 py-1 text-foreground focus:border-purple focus:outline-none"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);
