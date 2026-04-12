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
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
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
async def extract_document(
    file: UploadFile = File(...),
    extractor: DocumentExtractor = Depends(get_extractor),
) -> ExtractionResponse:
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
def save_extraction(
    body: ExtractionRecordIn,
    supabase: Client = Depends(get_supabase),
) -> ExtractionRecordOut:
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
