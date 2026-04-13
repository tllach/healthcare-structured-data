"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SubmittedBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchParams.get("submitted") !== "true") {
      setVisible(false);
      return;
    }
    setVisible(true);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      router.replace("/", { scroll: false });
    }, 5000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [searchParams, router]);

  function dismiss() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
    router.replace("/", { scroll: false });
  }

  if (!visible) return null;

  return (
    <div
      className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900"
      role="status"
    >
      <p className="text-sm font-medium">
        ✓ Service request submitted successfully. Start a new extraction below.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded p-1 text-green-800 transition-colors hover:bg-green-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
