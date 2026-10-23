import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

export const Field = ({ label, hint, className = "", ...props }: Props) => (
  <label className="flex flex-col gap-1">
    <span className="text-sm text-comment">{label}</span>
    <input
      className={`rounded border border-comment bg-background px-3 py-2 text-foreground focus:border-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
    {hint ? <span className="text-xs text-comment">{hint}</span> : null}
  </label>
);
