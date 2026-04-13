import { type ReactNode } from "react";
import { clsx } from "clsx";

export type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "info";

export interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: ReactNode;
}

const variantClass: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  neutral: "bg-gray-100 text-gray-700",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({ variant, label, icon }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClass[variant]
      )}
    >
      {icon}
      {label}
    </span>
  );
}
