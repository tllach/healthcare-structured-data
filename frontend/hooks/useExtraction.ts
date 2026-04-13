"use client";

import { useCallback, useState } from "react";
import type { ExtractionResult } from "@/lib/types";

export function useExtraction() {
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    result,
    setResult,
    isLoading,
    setIsLoading,
    error,
    setError,
    reset,
  };
}
