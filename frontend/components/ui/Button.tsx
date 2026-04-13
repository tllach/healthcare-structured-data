import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary:"border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

const spinnerSize: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      onClick,
      loading = false,
      disabled = false,
      fullWidth = false,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          variantClass[variant],
          sizeClass[size],
          fullWidth && "w-full",
          loading && "pointer-events-none opacity-60",
          isDisabled && "disabled:cursor-not-allowed",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {loading && <Spinner size={spinnerSize[size]} />}
        {children}
      </button>
    );
  }
);
