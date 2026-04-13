import type { ConfidenceScores, ExtractionResult } from "./types";

export function countStats(
  data: ExtractionResult,
  confidence: ConfidenceScores
): { autoFilled: number; needsReview: number; notFound: number } {
  let autoFilled = 0;
  let needsReview = 0;
  let notFound = 0;

  function bump(obj: object, conf: number) {
    for (const v of Object.values(obj)) {
      if (v === null) notFound++;
      else if (conf >= 0.85) autoFilled++;
      else needsReview++;
    }
  }

  bump(data.patient, confidence.patient);
  bump(data.insurance, confidence.insurance);
  bump(data.requesting_provider, confidence.requesting_provider);
  bump(data.referring_provider, confidence.referring_provider);
  bump(data.service_request, confidence.service_request);
  bump(data.attestation, confidence.requesting_provider);
  bump(data.payer, 0);

  return { autoFilled, needsReview, notFound };
}

export function computeCorrections(
  original: ExtractionResult,
  final: ExtractionResult
): Record<string, { original: unknown; corrected: unknown }> {
  const out: Record<string, { original: unknown; corrected: unknown }> = {};

  function diffValue(
    a: unknown,
    b: unknown,
    path: string,
    acc: Record<string, { original: unknown; corrected: unknown }>
  ) {
    if (Object.is(a, b)) return;
    if (
      a !== null &&
      b !== null &&
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      const keys = Array.from(
        new Set([
          ...Object.keys(a as object),
          ...Object.keys(b as object),
        ])
      );
      for (const k of keys) {
        const p = path ? `${path}.${k}` : k;
        diffValue(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          p,
          acc
        );
      }
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        acc[path] = { original: a, corrected: b };
      }
      return;
    }
    acc[path] = { original: a, corrected: b };
  }

  for (const key of Object.keys(original) as (keyof ExtractionResult)[]) {
    diffValue(original[key], final[key], String(key), out);
  }

  return out;
}
