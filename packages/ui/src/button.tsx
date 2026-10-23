import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-purple text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
  ghost: "border border-comment text-foreground hover:bg-current-line",
  danger:
    "bg-red text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm gap-1",
  md: "px-4 py-2 gap-1.5",
};

export const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: Props) => (
  <button
    className={`inline-flex items-center justify-center rounded font-semibold transition ${styles[variant]} ${sizes[size]} ${className}`}
    {...props}
  />
);
