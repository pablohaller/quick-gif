"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OutputCard } from "@/components/outputs/output-card";
import { SortSelect, useSortMode } from "@/components/ui/sort-select";
import type { OutputMeta } from "@/lib/types";

const Page = () => {
  const [outputDir, setOutputDir] = useState("");
  const [outputs, setOutputs] = useState<OutputMeta[]>([]);
  const [sort, setSort] = useSortMode("quick-gif:sort:outputs");

  const sorted = useMemo(
    () =>
      [...outputs].sort((a, b) =>
        sort === "name" ? a.file.localeCompare(b.file) : b.modifiedAt - a.modifiedAt,
      ),
    [outputs, sort],
  );

  const refresh = useCallback(() => {
    fetch("/api/outputs")
      .then((r) => r.json())
      .then((b) => {
        setOutputs(b.outputs ?? []);
        setOutputDir(b.outputDir ?? "");
      })
      .catch(() => setOutputs([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = async (file: string) => {
    if (!window.confirm(`Delete ${file}? This cannot be undone.`)) return;
    setOutputs((prev) => prev.filter((o) => o.file !== file));
    const res = await fetch(`/api/gif?file=${encodeURIComponent(file)}`, { method: "DELETE" });
    if (!res.ok) refresh();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Outputs</h1>
        <div className="flex min-w-0 items-center gap-3">
          {outputs.length > 1 ? <SortSelect value={sort} onChange={setSort} /> : null}
          <span className="truncate text-xs text-comment">{outputDir || "—"}</span>
        </div>
      </div>

      {outputs.length === 0 ? (
        <p className="text-sm text-comment">No exports yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((o) => (
            <OutputCard key={o.file} o={o} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Page;
