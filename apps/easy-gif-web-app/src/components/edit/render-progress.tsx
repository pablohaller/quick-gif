"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// Progress bar + spinner + elapsed/ETA. Mounted only while a render runs, so the
// elapsed timer resets each time.
export const RenderProgress = ({ progress }: { progress: number }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      250,
    );
    return () => clearInterval(id);
  }, []);

  const pct = Math.round(progress * 100);
  // Rough ETA from the rate so far; only once there's enough signal.
  const eta =
    progress > 0.03 && progress < 0.99
      ? Math.max(0, Math.round((elapsed * (1 - progress)) / progress))
      : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-current-line">
        <div
          className="h-full rounded-full bg-purple transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="flex items-center gap-1.5 text-xs text-comment">
        <Loader2 className="h-3 w-3 animate-spin" />
        {pct}% · {elapsed.toFixed(0)}s elapsed
        {eta !== null ? ` · ~${eta}s left` : ""}
      </span>
    </div>
  );
};
