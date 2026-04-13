"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AlertCircle, FileStack, Sparkles, UserCheck } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { Button, Spinner } from "@/components/ui";
import * as api from "@/lib/api";

type PageState = "idle" | "extracting" | "error";

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7355/ingest/7fcae4ed-8ac1-4c76-a5f1-4aa21e49778e", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "d84aa8",
      },
      body: JSON.stringify({
        sessionId: "d84aa8",
        location: "page.tsx:HomePage",
        message: "Client Component mounted",
        data: { useClientDirective: true },
        timestamp: Date.now(),
        runId: "post-fix",
        hypothesisId: "H1",
      }),
    }).catch(() => {});
  }, []);
  // #endregion

  async function handleFileSelect(file: File) {
    setState("extracting");
    setErrorMessage("");
    try {
      const result = await api.extractDocument(file);
      sessionStorage.setItem("extractionResult", JSON.stringify(result));
      sessionStorage.setItem("extractionFileName", file.name);
      router.push("/review");
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Extraction failed. Please try again."
      );
    }
  }

  function resetToIdle() {
    setState("idle");
    setErrorMessage("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <section className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Extract. Review. Submit.
          </h1>
          <p className="mt-3 text-gray-500">
            Upload any clinical document and let AI pre-fill your service request
            form
          </p>
        </section>

        <div className="relative mx-auto max-w-2xl">
          <UploadZone
            onFileSelect={handleFileSelect}
            disabled={state === "extracting"}
          />
          {state === "extracting" && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/80 px-6 text-center backdrop-blur-[2px]"
              role="status"
              aria-live="polite"
            >
              <Spinner size="lg" className="text-blue-600" />
              <p className="font-medium text-gray-900">
                Analyzing document with AI
                <span className="inline-flex gap-0.5 pl-0.5" aria-hidden>
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-gray-500 animate-loading-dot"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-gray-500 animate-loading-dot"
                    style={{ animationDelay: "200ms" }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-gray-500 animate-loading-dot"
                    style={{ animationDelay: "400ms" }}
                  />
                </span>
              </p>
              <p className="text-sm text-gray-400">
                This usually takes 10-20 seconds
              </p>
            </div>
          )}
        </div>

        {state === "error" && (
          <div
            className="mx-auto mt-6 flex max-w-2xl gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-900">{errorMessage}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={resetToIdle}
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Card Section */}
        <section className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <FileStack className="h-8 w-8 text-blue-500" aria-hidden />
            <h2 className="mt-3 font-semibold text-gray-900">Any Format</h2>
            <p className="mt-2 text-sm text-gray-600">
              PDFs, scanned faxes, handwritten notes
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Sparkles className="h-8 w-8 text-blue-500" aria-hidden />
            <h2 className="mt-3 font-semibold text-gray-900">AI Extraction</h2>
            <p className="mt-2 text-sm text-gray-600">
              Powered by Claude, fields auto-detected
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <UserCheck className="h-8 w-8 text-blue-500" aria-hidden />
            <h2 className="mt-3 font-semibold text-gray-900">Human Review</h2>
            <p className="mt-2 text-sm text-gray-600">
              You verify before submitting
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}