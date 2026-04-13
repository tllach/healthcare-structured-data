"use client";

import { type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { ConfidenceBadge } from "./ConfidenceBadge";

export interface SectionCardProps {
  title: string;
  icon: ReactNode;
  confidence: number;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Controlled open state (when provided, overrides internal state). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function shouldAutoOpen(confidence: number): boolean {
  return confidence < 0.85 || confidence === 0;
}

export function SectionCard({ title, icon, confidence, children, defaultOpen, open: controlledOpen, onOpenChange }: SectionCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    defaultOpen !== undefined ? defaultOpen : shouldAutoOpen(confidence)
  );
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex shrink-0 text-gray-600">{icon}</span>
          <span className="truncate font-semibold text-gray-900">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge score={confidence} />
          <ChevronDown
            className={clsx(
              "h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-[max-height] duration-300 ease-in-out",
          open ? "max-h-[2000px]" : "max-h-0"
        )}
      >
        <div className="border-t border-gray-100 px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
