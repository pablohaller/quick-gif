"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export const Modal = ({ open, onClose, title, children }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-current-line bg-current-line shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="border-b border-background px-5 py-3">
            <h2 className="font-semibold text-foreground">{title}</h2>
          </div>
        ) : null}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
