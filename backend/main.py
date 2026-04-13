from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from supabase import Client, create_client

from models import (
    AccuracyStats,
    ExtractionRecordIn,
    ExtractionRecordOut,
    ExtractionResponse,
    SectionAccuracyStats,
)
from services.extractor import DocumentExtractor

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ALLOWED_MEDIA_TYPES: dict[str, str] = {
    "application/pdf": "application/pdf",
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/tiff": "image/tiff",
    "image/webp": "image/webp",
}

EXTENSION_TO_MEDIA: dict[str, str] = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".webp": "image/webp",
}


def _normalize_media_type(media_type: str) -> str:
    mt = media_type.lower().strip()
    if mt == "image/jpg":
        return "image/jpeg"
    return mt


def _resolve_media_type(upload: UploadFile, filename: str) -> str:
    raw = (upload.content_type or "").strip()
    if raw:
        n = _normalize_media_type(raw)
        if n in ALLOWED_MEDIA_TYPES:
            return ALLOWED_MEDIA_TYPES[n]

    lower = filename.lower()
    for ext, mt in EXTENSION_TO_MEDIA.items():
        if lower.endswith(ext):
            return mt

    raise HTTPException(
        status_code=400,
        detail="Unsupported file type. Allowed: pdf, png, jpg, jpeg, tiff, webp.",
    )


_extractor: DocumentExtractor | None = None
_supabase: Client | None = None


def get_extractor() -> DocumentExtractor:
    global _extractor
    if _extractor is None:
        _extractor = DocumentExtractor()
    return _extractor


def get_supabase() -> Client:
    global _supabase
    if _supabase is not None:
        return _supabase

    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY).",
        )
    _supabase = create_client(url, key)
    return _supabase


app = FastAPI(title="Healthcare API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://healthcare-structured-data.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/extract", response_model=ExtractionResponse)
async def extract_document( file: UploadFile = File(...), extractor: DocumentExtractor = Depends(get_extractor), ) -> ExtractionResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")

    media_type = _resolve_media_type(file, file.filename)

    try:
        content = await file.read()
    except Exception as e:
        logger.exception("Failed to read upload")
        raise HTTPException(
            status_code=400, detail="Could not read uploaded file."
        ) from e

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    started = time.perf_counter()
    try:
        result, document_type = await extractor.extract(content, media_type)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected extraction error")
        raise HTTPException(
            status_code=502,
            detail="Document extraction failed due to an unexpected error.",
        ) from e

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return ExtractionResponse(
        result=result,
        processing_time_ms=elapsed_ms,
        document_type=document_type,
    )


@app.post("/save", response_model=ExtractionRecordOut)
def save_extraction( body: ExtractionRecordIn, supabase: Client = Depends(get_supabase) ) -> ExtractionRecordOut:
    if body.status not in ("pending", "reviewed", "submitted"):
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be pending, reviewed, or submitted.",
        )

    row: dict[str, Any] = {
        "file_name": body.file_name,
        "file_url": body.file_url,
        "raw_extracted": body.raw_extracted,
        "final_submitted": body.final_submitted,
        "corrections": body.corrections,
        "status": body.status,
        "document_type": body.document_type,
    }

    try:
        res = supabase.table("extractions").insert(row).execute()
    except Exception as e:
        logger.exception("Supabase insert failed")
        raise HTTPException(
            status_code=502,
            detail="Failed to save extraction to the database.",
        ) from e

    data = getattr(res, "data", None) or []
    if not data:
        raise HTTPException(
            status_code=502, detail="Save did not return a persisted record."
        )

    saved = data[0]
    try:
        return ExtractionRecordOut.model_validate(saved)
    except ValidationError as e:
        logger.warning("Response shape mismatch: %s", saved)
        raise HTTPException(
            status_code=502,
            detail="Saved record could not be validated.",
        ) from e


def _to_accuracy_row(row: dict[str, Any]) -> AccuracyStats:
    pct = row.get("accuracy_pct")
    if pct is not None:
        pct = float(pct)
    else:
        pct = 0.0
    return AccuracyStats(
        field_key=str(row.get("field_key", "")),
        total=int(row.get("total", 0) or 0),
        corrected=int(row.get("corrected", 0) or 0),
        accuracy_pct=pct,
    )


@app.get("/accuracy", response_model=list[AccuracyStats])
def accuracy_stats(supabase: Client = Depends(get_supabase)) -> list[AccuracyStats]:
    try:
        res = supabase.table("accuracy_stats").select("*").execute()
    except Exception as e:
        logger.exception("Supabase accuracy_stats query failed")
        raise HTTPException(
            status_code=502,
            detail="Failed to load accuracy statistics.",
        ) from e

    rows = getattr(res, "data", None) or []
    return [_to_accuracy_row(r) for r in rows if isinstance(r, dict)]


SECTION_KEYS: tuple[str, ...] = (
    "patient",
    "insurance",
    "requesting_provider",
    "referring_provider",
    "service_request",
    "diagnoses",
    "procedures",
    "medications",
    "lab_results",
    "clinical_information",
)


def _final_has_section(final: dict[str, Any], section: str) -> bool:
    if section not in final:
        return False
    return final.get(section) is not None


def _corrections_touch_section(corrections: Any, section: str) -> bool:
    if not isinstance(corrections, dict) or not corrections:
        return False
    prefix = f"{section}."
    for k in corrections:
        sk = str(k)
        if sk == section or sk.startswith(prefix):
            return True
    return False


def _confidence_value(raw: dict[str, Any], section: str) -> float:
    conf = raw.get("confidence")
    if not isinstance(conf, dict):
        return 0.0
    v = conf.get(section)
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _compute_section_accuracy_stats(rows: list[dict[str, Any]]) -> list[SectionAccuracyStats]:
    completed: list[dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        fs = r.get("final_submitted")
        if fs is None:
            continue
        if not isinstance(fs, dict):
            continue
        completed.append(r)

    if not completed:
        return []

    out: list[SectionAccuracyStats] = []
    for section in SECTION_KEYS:
        total = 0
        correction_count = 0
        conf_sum = 0.0

        for r in completed:
            final = r.get("final_submitted")
            if not isinstance(final, dict):
                continue
            if not _final_has_section(final, section):
                continue
            total += 1
            raw = r.get("raw_extracted")
            if not isinstance(raw, dict):
                raw = {}
            conf_sum += _confidence_value(raw, section)
            corr = r.get("corrections")
            if _corrections_touch_section(corr, section):
                correction_count += 1

        if total == 0:
            correction_rate = 0.0
            accuracy_rate = 0.0
            avg_model_confidence = 0.0
        else:
            correction_rate = correction_count / total
            accuracy_rate = 1.0 - correction_rate
            avg_model_confidence = conf_sum / total

        calibration_delta = avg_model_confidence - accuracy_rate

        out.append(
            SectionAccuracyStats(
                section=section,
                avg_model_confidence=round(avg_model_confidence, 4),
                total_submissions=total,
                correction_count=correction_count,
                correction_rate=round(correction_rate, 4),
                accuracy_rate=round(accuracy_rate, 4),
                calibration_delta=round(calibration_delta, 4),
            )
        )
    return out


@app.get("/accuracy/full", response_model=list[SectionAccuracyStats])
def accuracy_full(supabase: Client = Depends(get_supabase)) -> list[SectionAccuracyStats]:
    try:
        res = supabase.table("extractions").select("*").execute()
    except Exception as e:
        logger.exception("Supabase extractions query failed for accuracy/full")
        raise HTTPException(
            status_code=502,
            detail="Failed to load extractions for accuracy.",
        ) from e

    rows = getattr(res, "data", None) or []
    if not isinstance(rows, list):
        rows = []
    return _compute_section_accuracy_stats(
        [r for r in rows if isinstance(r, dict)]
    )


@app.get("/submissions", response_model=list[ExtractionRecordOut])
def list_submissions( limit: int = 20, supabase: Client = Depends(get_supabase) ) -> list[ExtractionRecordOut]:
    limit = min(max(limit, 1), 100)
    try:
        res = (
            supabase.table("extractions")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as e:
        logger.exception("Supabase extractions list failed")
        raise HTTPException(
            status_code=502,
            detail="Failed to load submissions.",
        ) from e

    rows = getattr(res, "data", None) or []
    out: list[ExtractionRecordOut] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        raw = r.get("raw_extracted")
        doc_type = "unknown"
        if isinstance(raw, dict):
            dt = raw.get("document_type")
            if isinstance(dt, str) and dt.strip():
                doc_type = dt.strip()
        merged = {**r, "document_type": doc_type}
        try:
            out.append(ExtractionRecordOut.model_validate(merged))
        except ValidationError:
            logger.warning("Skipping invalid extraction row: %s", r.get("id"))
    return out
