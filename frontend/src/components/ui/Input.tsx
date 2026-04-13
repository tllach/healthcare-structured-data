import { forwardRef, type ChangeEvent, type ForwardedRef, useId } from "react";
import { clsx } from "clsx";

const EMPTY_PLACEHOLDER = "Not found — enter manually";

export interface InputProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  confidence?: number;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

function confidenceFieldClass(confidence: number | undefined): string {
  if (confidence === undefined || confidence === 0) {
    return "border border-gray-300 bg-white";
  }
  if (confidence >= 0.85) {
    return "border border-gray-300 border-l-4 border-l-green-400 bg-green-50";
  }
  if (confidence >= 0.6) {
    return "border border-gray-300 border-l-4 border-l-yellow-400 bg-yellow-50";
  }
  return "border border-gray-300 border-l-4 border-l-red-400 bg-red-50";
}

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  function Input({
    label,
    value,
    onChange,
    error,
    hint,
    disabled = false,
    confidence,
    placeholder,
    multiline = false,
    rows = 4,
  },
  ref
) {
  const id = useId();
  const isEmpty = value === "";
  const resolvedPlaceholder = isEmpty ? EMPTY_PLACEHOLDER : placeholder ?? "";
  const showLowConfidenceWarning =
    confidence !== undefined &&
    confidence > 0 &&
    confidence < 0.6;

  const sharedClass = clsx(
    "w-full rounded-lg px-3 py-2 text-gray-900 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
    "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60",
    "placeholder:italic placeholder:text-red-400",
    showLowConfidenceWarning && "pr-9",
    confidenceFieldClass(confidence),
    error && "ring-2 ring-red-500"
  );

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea
            ref={ref as ForwardedRef<HTMLTextAreaElement>}
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            rows={rows}
            placeholder={resolvedPlaceholder}
            aria-invalid={!!error}
            aria-describedby={
              error || hint
                ? `${id}-hint`
                : undefined
            }
            className={clsx(sharedClass, "min-h-[2.5rem] resize-y")}
          />
        ) : (
          <input
            ref={ref as ForwardedRef<HTMLInputElement>}
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={resolvedPlaceholder}
            aria-invalid={!!error}
            aria-describedby={
              error || hint
                ? `${id}-hint`
                : undefined
            }
            className={sharedClass}
          />
        )}
        {showLowConfidenceWarning && (
          <span
            className={clsx(
              "pointer-events-none absolute right-3 text-amber-600",
              multiline ? "top-3" : "top-1/2 -translate-y-1/2"
            )}
            aria-hidden
          >
            ⚠
          </span>
        )}
      </div>
      {(hint || error) && (
        <p
          id={`${id}-hint`}
          className={clsx(
            "mt-1 text-xs",
            error ? "text-red-600" : "text-gray-500"
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
