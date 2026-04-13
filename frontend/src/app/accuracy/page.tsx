"use client";

import {
  AlertCircle,
  CheckCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button } from "@/components/ui";
import * as api from "@/lib/api";
import type { AccuracyStats, ExtractionRecord } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const FIELD_LABELS: Record<string, string> = {
  patient: "Patient Information",
  insurance: "Insurance Details",
  requesting_provider: "Requesting Provider",
  referring_provider: "Referring Provider",
  service_request: "Service Details",
  diagnoses: "Diagnoses (ICD-10)",
  procedures: "Procedures (CPT)",
  medications: "Medications",
  lab_results: "Lab Results",
  clinical_information: "Clinical Information",
};

function formatFieldKey(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} at ${timePart}`;
}

function formatFetchedAt(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateFileName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function countCorrectionKeys(
  corrections: Record<string, unknown> | undefined
): number {
  if (!corrections || typeof corrections !== "object") return 0;
  return Object.keys(corrections).length;
}

function accuracyBarColor(pct: number): "green" | "yellow" | "red" {
  if (pct >= 80) return "green";
  if (pct >= 60) return "yellow";
  return "red";
}

function accuracyBadgeVariant(
  pct: number
): "success" | "warning" | "error" {
  if (pct >= 80) return "success";
  if (pct >= 60) return "warning";
  return "error";
}

function accuracyBadgeLabel(pct: number): string {
  if (pct >= 80) return "Good";
  if (pct >= 60) return "Review";
  return "Poor";
}

function statusBadgeVariant(
  status: ExtractionRecord["status"]
): "success" | "warning" | "neutral" | "info" {
  switch (status) {
    case "submitted":
      return "success";
    case "reviewed":
      return "info";
    default:
      return "warning";
  }
}

export default function AccuracyPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [stats, setStats] = useState<AccuracyStats[]>([]);
  const [recent, setRecent] = useState<ExtractionRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");
    try {
      const [accuracyRows, submissions] = await Promise.all([
        api.getAccuracyStats(),
        api.getRecentSubmissions(),
      ]);
      setStats(accuracyRows);
      setRecent(submissions);
      setLastUpdated(new Date());
      setLoadState("ready");
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "Could not load accuracy data"
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedStats = useMemo(() => {
    return [...stats].sort((a, b) => a.accuracy_pct - b.accuracy_pct);
  }, [stats]);

  const summary = useMemo(() => {
    if (stats.length === 0) {
      return {
        totalSubmissions: 0,
        overallAccuracy: 0,
        best: null as AccuracyStats | null,
        worst: null as AccuracyStats | null,
      };
    }

    const sumTotal = stats.reduce((s, r) => s + r.total, 0);
    const totalSubmissions =
      stats.length > 0 ? Math.round(sumTotal / stats.length) : 0;

    const weight = stats.reduce((s, r) => s + r.total, 0);
    const overallAccuracy =
      weight > 0
        ? stats.reduce((s, r) => s + r.accuracy_pct * r.total, 0) / weight
        : 0;

    const best = stats.reduce((a, b) =>
      a.accuracy_pct >= b.accuracy_pct ? a : b
    );
    const worst = stats.reduce((a, b) =>
      a.accuracy_pct <= b.accuracy_pct ? a : b
    );

    return { totalSubmissions, overallAccuracy, best, worst };
  }, [stats]);

  const overallIconColor =
    summary.overallAccuracy >= 80
      ? "green"
      : summary.overallAccuracy >= 60
        ? "yellow"
        : "red";

  const isEmpty =
    loadState === "ready" && stats.length === 0 && recent.length === 0;

  if (loadState === "error") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
            role="alert"
          >
            <p className="font-medium">Could not load accuracy data</p>
            {errorMessage ? (
              <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
            ) : null}
            <Button className="mt-4" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-96 max-w-full animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-8 w-full animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="h-10 animate-pulse bg-gray-100" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse border-t border-gray-100 bg-white"
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-4 h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="h-10 animate-pulse bg-gray-100" />
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse border-t border-gray-100 bg-white"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center py-24 text-center">
          <FileText className="mb-4 h-16 w-16 text-gray-300" aria-hidden />
          <p className="text-lg font-medium text-gray-500">
            No submissions yet
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Submit your first service request to start tracking accuracy
          </p>
          <Button className="mt-8" onClick={() => router.push("/")}>
            Extract a Document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Extraction Accuracy
            </h1>
            <p className="mt-1 text-gray-600">
              Track how often AI-extracted fields are corrected by reviewers
            </p>
          </div>
          {lastUpdated ? (
            <p className="text-sm text-gray-500">
              Last updated {formatFetchedAt(lastUpdated)}
            </p>
          ) : null}
        </header>

        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 p-2">
                <FileText className="h-5 w-5 text-blue-600" aria-hidden />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {summary.totalSubmissions}
                </div>
                <div className="text-sm text-gray-500">Total Submissions</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg p-2 ${
                  overallIconColor === "green"
                    ? "bg-green-50"
                    : overallIconColor === "yellow"
                      ? "bg-yellow-50"
                      : "bg-red-50"
                }`}
              >
                <TrendingUp
                  className={`h-5 w-5 ${
                    overallIconColor === "green"
                      ? "text-green-600"
                      : overallIconColor === "yellow"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                  aria-hidden
                />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.length === 0
                    ? "—"
                    : `${summary.overallAccuracy.toFixed(1)}%`}
                </div>
                <div className="text-sm text-gray-500">Overall Accuracy</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 p-2">
                <CheckCircle className="h-5 w-5 text-green-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-gray-900">
                  {summary.best
                    ? `${summary.best.accuracy_pct.toFixed(0)}%`
                    : "—"}
                </div>
                <div className="text-sm text-gray-500">Most Reliable Field</div>
                {summary.best ? (
                  <div className="truncate text-xs text-gray-600">
                    {formatFieldKey(summary.best.field_key)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 p-2">
                <AlertCircle className="h-5 w-5 text-red-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-bold text-gray-900">
                  {summary.worst
                    ? `${summary.worst.accuracy_pct.toFixed(0)}%`
                    : "—"}
                </div>
                <div className="text-sm text-gray-500">
                  Needs Most Attention
                </div>
                {summary.worst ? (
                  <div className="truncate text-xs text-gray-600">
                    {formatFieldKey(summary.worst.field_key)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 font-semibold text-gray-900">
            Accuracy by Field
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <th className="px-4 py-3">Field</th>
                    <th className="px-4 py-3">Total Extractions</th>
                    <th className="px-4 py-3">Auto-filled Correct</th>
                    <th className="px-4 py-3">Corrected by User</th>
                    <th className="px-4 py-3">Accuracy %</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((row) => {
                    const autoCorrect = row.total - row.corrected;
                    const bar = accuracyBarColor(row.accuracy_pct);
                    return (
                      <tr
                        key={row.field_key}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatFieldKey(row.field_key)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.total}</td>
                        <td className="px-4 py-3 text-gray-700">{autoCorrect}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {row.corrected}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {row.accuracy_pct.toFixed(1)}%
                            </span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full rounded-full ${
                                  bar === "green"
                                    ? "bg-green-500"
                                    : bar === "yellow"
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, row.accuracy_pct)
                                  )}%`,
                                }}
                              />
                            </div>
                            <Badge
                              variant={accuracyBadgeVariant(row.accuracy_pct)}
                              label={accuracyBadgeLabel(row.accuracy_pct)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-semibold text-gray-900">
            Recent Submissions
          </h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Fields Corrected</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((rec) => {
                    const docType =
                      rec.raw_extracted?.document_type ?? "unknown";
                    const n = countCorrectionKeys(
                      rec.corrections as Record<string, unknown>
                    );
                    const corrVariant =
                      n === 0 ? "success" : n <= 3 ? "warning" : "error";
                    const corrLabel =
                      n === 0 ? "No corrections" : `${n} corrections`;
                    return (
                      <tr
                        key={rec.id}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td
                          className="max-w-[200px] truncate px-4 py-3 text-gray-900"
                          title={rec.file_name}
                        >
                          {truncateFileName(rec.file_name, 30)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="info" label={docType} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatSubmittedAt(rec.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={corrVariant} label={corrLabel} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusBadgeVariant(rec.status)}
                            label={rec.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
