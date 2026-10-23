"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

// Collapsible section built on native <details> (no open-state management).
export const Accordion = ({ title, summary, defaultOpen = false, children }: Props) => (
  <details
    open={defaultOpen}
    className="group rounded-lg border border-current-line bg-current-line [&_summary::-webkit-details-marker]:hidden"
  >
    <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3">
      <span className="font-semibold">{title}</span>
      <span className="flex items-center gap-2 text-sm text-comment">
        {summary}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </span>
    </summary>
    <div className="flex flex-col gap-4 border-t border-current-line px-4 py-4">
      {children}
    </div>
  </details>
);
