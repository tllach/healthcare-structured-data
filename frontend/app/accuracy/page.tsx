"use client";

import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle,
  FileText,
  TrendingDown,
  UserCheck,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge, Button } from "@/components/ui";
import * as api from "@/lib/api";
import type { ExtractionRecord } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const SECTION_LABELS: Record<string, string> = {
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

const SECTION_SHORT: Record<string, string> = {
  patient: "Patient",
  insurance: "Insurance",
  requesting_provider: "Req. provider",
  referring_provider: "Ref. provider",
  service_request: "Service",
  diagnoses: "Diagnoses",
  procedures: "Procedures",
  medications: "Medications",
  lab_results: "Labs",
  clinical_information: "Clinical",
};

function formatSectionName(section: string): string {
  return (
    SECTION_LABELS[section] ??
    section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatSectionShort(section: string): string {
  return SECTION_SHORT[section] ?? formatSectionName(section);
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

function correctionTopLevelKeys(
  corrections: Record<string, unknown> | undefined
): string[] {
  if (!corrections || typeof corrections !== "object") return [];
  const tops = new Set<string>();
  for (const k of Object.keys(corrections)) {
    const dot = k.indexOf(".");
    tops.add(dot === -1 ? k : k.slice(0, dot));
  }
  return Array.from(tops);
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

function tierColor(
  rate: number,
  hi: number,
  mid: number
): "green" | "yellow" | "red" {
  if (rate >= hi) return "green";
  if (rate >= mid) return "yellow";
  return "red";
}

function userAccuracyBarClass(rate: number): string {
  if (rate >= 0.8) return "bg-green-500";
  if (rate >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}

function calibrationGapColor(gap: number): "green" | "yellow" | "red" {
  if (gap < 0.1) return "green";
  if (gap < 0.2) return "yellow";
  return "red";
}

export default function AccuracyPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [stats, setStats] = useState<api.SectionAccuracyStats[]>([]);
  const [recent, setRecent] = useState<ExtractionRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");
    try {
      const [fullStats, submissions] = await Promise.all([
        api.getFullAccuracyStats(),
        api.getRecentSubmissions(),
      ]);
      setStats(fullStats);
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

  const sortedTableStats = useMemo(() => {
    return [...stats].sort((a, b) => a.accuracy_rate - b.accuracy_rate);
  }, [stats]);

  const chartData = useMemo(() => {
    return [...stats]
      .sort((a, b) => a.accuracy_rate - b.accuracy_rate)
      .map((s) => ({
        name: formatSectionName(s.section),
        avg_model_confidence_pct: Math.round(s.avg_model_confidence * 100),
        accuracy_rate_pct: Math.round(s.accuracy_rate * 100),
      }));
  }, [stats]);

  const summary = useMemo(() => {
    if (stats.length === 0) {
      return {
        totalSubmissions: 0,
        avgModelConfidence: 0,
        avgUserAccuracy: 0,
        avgCalibrationGap: 0,
      };
    }
    const totalSubmissions = stats[0]?.total_submissions ?? 0;
    const n = stats.length;
    const avgModelConfidence =
      stats.reduce((s, x) => s + x.avg_model_confidence, 0) / n;
    const avgUserAccuracy =
      stats.reduce((s, x) => s + x.accuracy_rate, 0) / n;
    const avgCalibrationGap =
      stats.reduce((s, x) => s + Math.abs(x.calibration_delta), 0) / n;
    return {
      totalSubmissions,
      avgModelConfidence,
      avgUserAccuracy,
      avgCalibrationGap,
    };
  }, [stats]);

  const modelConfTier = tierColor(summary.avgModelConfidence, 0.8, 0.6);
  const userAccTier = tierColor(summary.avgUserAccuracy, 0.8, 0.6);
  const calGapTier = calibrationGapColor(summary.avgCalibrationGap);

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
            <div className="mb-4 h-6 w-64 animate-pulse rounded bg-gray-200" />
            <div className="h-[380px] animate-pulse rounded-xl border border-gray-200 bg-white" />
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
                  modelConfTier === "green"
                    ? "bg-green-50"
                    : modelConfTier === "yellow"
                      ? "bg-yellow-50"
                      : "bg-red-50"
                }`}
              >
                <Brain
                  className={`h-5 w-5 ${
                    modelConfTier === "green"
                      ? "text-green-600"
                      : modelConfTier === "yellow"
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
                    : `${Math.round(summary.avgModelConfidence * 100)}%`}
                </div>
                <div className="text-sm text-gray-500">Avg Model Confidence</div>
                <div className="text-xs text-gray-400">
                  How confident AI reports being
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg p-2 ${
                  userAccTier === "green"
                    ? "bg-green-50"
                    : userAccTier === "yellow"
                      ? "bg-yellow-50"
                      : "bg-red-50"
                }`}
              >
                <UserCheck
                  className={`h-5 w-5 ${
                    userAccTier === "green"
                      ? "text-green-600"
                      : userAccTier === "yellow"
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
                    : `${Math.round(summary.avgUserAccuracy * 100)}%`}
                </div>
                <div className="text-sm text-gray-500">Avg User Accuracy</div>
                <div className="text-xs text-gray-400">
                  Fields accepted without changes
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg p-2 ${
                  calGapTier === "green"
                    ? "bg-green-50"
                    : calGapTier === "yellow"
                      ? "bg-yellow-50"
                      : "bg-red-50"
                }`}
              >
                <Activity
                  className={`h-5 w-5 ${
                    calGapTier === "green"
                      ? "text-green-600"
                      : calGapTier === "yellow"
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
                    : `${Math.round(summary.avgCalibrationGap * 100)}%`}
                </div>
                <div className="text-sm text-gray-500">Avg Calibration Gap</div>
                <div className="text-xs text-gray-400">
                  Difference between AI confidence and actual accuracy
                </div>
              </div>
            </div>
          </div>
        </section>

        {stats.length >= 2 ? (
          <section className="mb-10">
            <h2 className="mb-1 font-semibold text-gray-900">
              AI Confidence vs User Accuracy by Section
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Compare what the model reports vs what users actually accepted
            </p>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-6 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-blue-500" aria-hidden>
                    ■
                  </span>
                  AI Confidence
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-green-500" aria-hidden>
                    ■
                  </span>
                  User Accuracy
                </span>
              </div>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  barGap={4}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value)}%`,
                      String(name),
                    ]}
                  />
                  <Legend verticalAlign="top" />
                  <Bar
                    dataKey="avg_model_confidence_pct"
                    name="AI Confidence"
                    fill="#3b82f6"
                    barSize={14}
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="accuracy_rate_pct"
                    name="User Accuracy"
                    fill="#22c55e"
                    barSize={14}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-4 font-semibold text-gray-900">Section Breakdown</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">AI Confidence</th>
                    <th className="px-4 py-3">User Accuracy</th>
                    <th className="px-4 py-3">Corrections</th>
                    <th className="px-4 py-3">Calibration</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTableStats.map((row) => {
                    const aiPct = Math.round(row.avg_model_confidence * 100);
                    const uaPct = Math.round(row.accuracy_rate * 100);
                    const d = row.calibration_delta;
                    const dPct = Math.round(d * 100);
                    let calNode: ReactNode;
                    if (d > 0.15) {
                      calNode = (
                        <span
                          className="inline-flex cursor-default items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                          title="AI reports higher confidence than its actual accuracy warrants"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Overconfident +{dPct}%
                        </span>
                      );
                    } else if (d < -0.15) {
                      calNode = (
                        <span
                          className="inline-flex cursor-default items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-900"
                          title="AI is more accurate than its confidence scores suggest"
                        >
                          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                          Underconfident {dPct}%
                        </span>
                      );
                    } else {
                      calNode = (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                          Well calibrated
                        </span>
                      );
                    }
                    return (
                      <tr
                        key={row.section}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatSectionName(row.section)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {aiPct}%
                            </span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-blue-100">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, aiPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900">
                              {uaPct}%
                            </span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-full rounded-full ${userAccuracyBarClass(row.accuracy_rate)}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, uaPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {row.correction_count} of {row.total_submissions}
                        </td>
                        <td className="px-4 py-3">{calNode}</td>
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
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Fields Corrected</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((rec) => {
                    const keys = correctionTopLevelKeys(
                      rec.corrections as Record<string, unknown>
                    );
                    const shown = keys.slice(0, 3);
                    const more = keys.length - shown.length;
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
                        <td className="px-4 py-3 text-gray-700">
                          {formatSubmittedAt(rec.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {keys.length === 0 ? (
                            <span className="text-sm text-gray-400">—</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {shown.map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                                >
                                  {formatSectionShort(k)}
                                </span>
                              ))}
                              {more > 0 ? (
                                <span className="text-xs text-gray-500">
                                  +{more} more
                                </span>
                              ) : null}
                            </div>
                          )}
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
