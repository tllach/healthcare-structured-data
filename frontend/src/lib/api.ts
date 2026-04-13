import axios, { type InternalAxiosRequestConfig } from "axios";
import type {
  AccuracyStats,
  ExtractionRecord,
  ExtractionResult,
} from "./types";

export interface SectionAccuracyStats {
  section: string;
  avg_model_confidence: number;
  total_submissions: number;
  correction_count: number;
  correction_rate: number;
  accuracy_rate: number;
  calibration_delta: number;
}

const baseURL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const api = axios.create({
  baseURL,
});

function logRequestInDev(config: InternalAxiosRequestConfig) {
  if (process.env.NODE_ENV !== "development") return;
  const method = (config.method ?? "get").toUpperCase();
  const path = `${config.baseURL ?? ""}${config.url ?? ""}`;
  const hasBody = config.data !== undefined && config.data !== null;
  console.log(
    `[api] ${method} ${path}`,
    hasBody && !(config.data instanceof FormData)
      ? config.data
      : hasBody
        ? "[FormData]"
        : ""
  );
}

api.interceptors.request.use((config) => {
  logRequestInDev(config);
  const body = config.data;
  if (
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    typeof body === "object"
  ) {
    config.headers.set("Content-Type", "application/json");
  }
  return config;
});

export async function extractDocument( file: File ): Promise<ExtractionResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<ExtractionResult>("/extract", formData);
  return data;
}

export async function saveExtraction( payload: Omit<ExtractionRecord, "id" | "created_at"> ): Promise<ExtractionRecord> {
  const { data } = await api.post<ExtractionRecord>("/save", payload);
  return data;
}

export async function getAccuracyStats(): Promise<AccuracyStats[]> {
  const { data } = await api.get<AccuracyStats[]>("/accuracy");
  return data;
}

export async function getFullAccuracyStats(): Promise<SectionAccuracyStats[]> {
  const { data } = await api.get<SectionAccuracyStats[]>("/accuracy/full");
  return data;
}

export async function getRecentSubmissions(): Promise<ExtractionRecord[]> {
  const { data } = await api.get<ExtractionRecord[]>("/submissions", {
    params: { limit: 20 },
  });
  return data; 
}
