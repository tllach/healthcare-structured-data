"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ExtractionForm } from "@/components/ExtractionForm";
import { Button, Spinner } from "@/components/ui";
import * as api from "@/lib/api";
import type { ExtractionResult } from "@/lib/types";

type PageStatus = "loading" | "ready" | "submitting" | "error";

type ExtractionData = {
  result: ExtractionResult;
  document_type: string;
};

const STORAGE_KEYS = {
  RESULT: "extractionResult",
  FILE_NAME: "extractionFileName",
};

export default function ReviewPage() {
  const router = useRouter();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [data, setData] = useState<ExtractionData | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = () => {
    const raw = sessionStorage.getItem(STORAGE_KEYS.RESULT);
    const name = sessionStorage.getItem(STORAGE_KEYS.FILE_NAME);

    if (!raw || !name) {
      router.push("/");
      return;
    }

    try {
      const parsed: ExtractionData = JSON.parse(raw);

      setData(parsed);
      setFileName(name);
      setStatus("ready");
    } catch {
      handleError("Could not read extraction results. The data may be corrupted.");
    }
  };

  const handleError = (message: string) => {
    setStatus("error");
    setErrorMessage(message);
  };

  const handleSubmit = async ( finalData: ExtractionResult, corrections: Record<string, { original: unknown; corrected: unknown }> ) => {
    if (!data) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      await api.saveExtraction({
        file_name: fileName,
        raw_extracted: data.result,
        final_submitted: finalData,
        corrections,
        status: "submitted",
      });

      clearSession();
      router.push("/?submitted=true");
    } catch (err) {
      handleError(
        err instanceof Error ? err.message : "Failed to save extraction."
      );
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem(STORAGE_KEYS.RESULT);
    sessionStorage.removeItem(STORAGE_KEYS.FILE_NAME);
  };

  const renderLoading = () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner size="lg" className="text-blue-600" />
        <p className="font-medium text-gray-700">
          Loading extraction results...
        </p>
      </div>
    </div>
  );

  const renderFullError = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"
          role="alert"
        >
          <p className="text-red-900">{errorMessage}</p>
          <Button
            type="button"
            variant="primary"
            className="mt-6"
            onClick={() => router.push("/")}
          >
            Go back
          </Button>
        </div>
      </div>
    </div>
  );

  const renderInlineError = () => (
    <div
      className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
      role="alert"
    >
      <p>{errorMessage}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => {
          setStatus("ready");
          setErrorMessage("");
        }}
      >
        Dismiss
      </Button>
    </div>
  );

  if (status === "loading") return renderLoading();

  if (status === "error" && !data) return renderFullError();

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        {status === "error" && renderInlineError()}

        <ExtractionForm
          data={data}
          fileName={fileName}
          onSubmit={handleSubmit}
          isSubmitting={status === "submitting"}
        />
      </div>
    </div>
  );
}