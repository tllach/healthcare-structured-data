from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic

from models import (
    ConfidenceScores, ExtractionResult, Patient, Insurance,
    RequestingProvider, ReferringProvider, ServiceRequest,
    Diagnosis, Procedure, Medication, AssessmentScore,
    LabPanel, LabTest, ClinicalInformation, Attestation, Payer,
)

from services.prompt import EXTRACTION_PROMPT

logger = logging.getLogger(__name__)
CLAUDE_MODEL = "claude-haiku-4-5-20251001"


def _strip_code_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def _normalize_confidence(raw: Any) -> dict[str, float]:
    keys = (
        "patient", "insurance", "requesting_provider", "referring_provider",
        "service_request", "diagnoses", "procedures",
        "medications", "lab_results", "clinical_information",
    )
    out: dict[str, float] = {k: 0.0 for k in keys}
    if not isinstance(raw, dict):
        return out
    for k in keys:
        v = raw.get(k)
        try:
            out[k] = max(0.0, min(1.0, float(v))) if v is not None else 0.0
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _sanitize_medication(m: Any) -> dict:
    if isinstance(m, dict):
        return m
    if isinstance(m, str):
        try:
            parsed = json.loads(m)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        return {"name": m, "dose": None, "frequency": None, "prescriber": None}
    return {"name": str(m), "dose": None, "frequency": None, "prescriber": None}


def _sanitize_score(s: Any) -> dict:
    if isinstance(s, dict):
        return s
    if isinstance(s, str):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        return {"tool": s, "score": "unknown", "date": None, "interpretation": None}
    return {"tool": str(s), "score": "unknown", "date": None, "interpretation": None}


def _parse_extraction_payload(data: dict[str, Any]) -> tuple[ExtractionResult, str]:
    document_type = str(data.get("document_type") or "unknown").strip() or "unknown"

    confidence = ConfidenceScores.model_validate(
        _normalize_confidence(data.get("confidence"))
    )

    # medications — always objects, never strings
    meds_raw = data.get("medications") or []
    medications = (
        [Medication.model_validate(_sanitize_medication(m)) for m in meds_raw]
        if isinstance(meds_raw, list) else []
    )

    # assessment scores
    scores_raw = data.get("assessment_scores") or []
    assessment_scores = (
        [AssessmentScore.model_validate(_sanitize_score(s)) for s in scores_raw]
        if isinstance(scores_raw, list) else []
    )

    # lab results
    labs_raw = data.get("lab_results") or []
    lab_results = (
        [LabPanel.model_validate(p) for p in labs_raw]
        if isinstance(labs_raw, list) else []
    )

    # simple object sections
    patient             = Patient.model_validate(data.get("patient") or {})
    insurance           = Insurance.model_validate(data.get("insurance") or {})
    requesting_provider = RequestingProvider.model_validate(data.get("requesting_provider") or {})
    referring_provider  = ReferringProvider.model_validate(data.get("referring_provider") or {})
    service_request     = ServiceRequest.model_validate(data.get("service_request") or {})
    clinical_info       = ClinicalInformation.model_validate(data.get("clinical_information") or {})
    attestation         = Attestation.model_validate(data.get("attestation") or {})
    payer               = Payer.model_validate(data.get("payer") or {})

    # diagnoses / procedures
    diagnoses = [
        Diagnosis.model_validate(x)
        for x in (data.get("diagnoses") or [])
        if isinstance(x, dict)
    ]
    procedures = [
        Procedure.model_validate(x)
        for x in (data.get("procedures") or [])
        if isinstance(x, dict)
    ]

    extraction_notes = [str(n) for n in (data.get("extraction_notes") or [])]

    result = ExtractionResult(
        payer=payer,
        patient=patient,
        insurance=insurance,
        requesting_provider=requesting_provider,
        referring_provider=referring_provider,
        service_request=service_request,
        diagnoses=diagnoses,
        procedures=procedures,
        medications=medications,
        assessment_scores=assessment_scores,
        lab_results=lab_results,
        clinical_information=clinical_info,
        attestation=attestation,
        confidence=confidence,
        extraction_notes=extraction_notes,
    )
    return result, document_type


class DocumentExtractor:
    def __init__(self) -> None:
        self.client = AsyncAnthropic()


    def _build_content_blocks(self, file_content: bytes, media_type: str) -> list[dict[str, Any]]:
        b64 = base64.standard_b64encode(file_content).decode("ascii")
        prompt = EXTRACTION_PROMPT

        if media_type == "application/pdf":
            return [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": b64,
                    },
                },
                {"type": "text", "text": prompt},
            ]

        return [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": b64,
                },
            },
            {"type": "text", "text": prompt},
        ]

    async def extract( self, file_content: bytes, media_type: str) -> ExtractionResult:
        content_blocks = self._build_content_blocks(file_content, media_type)

        try:
            message = await self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4000,
                system="Return ONLY valid JSON. No explanations. No markdown. No backticks. Use null for missing fields.",
                messages=[
                    {
                        "role": "user",
                        "content": content_blocks,
                    }
                ],
            )
        except Exception as e:
            logger.exception("Anthropic API request failed")
            raise RuntimeError(
                "The document extraction service failed to process your request. Please try again."
            ) from e

        raw_text = "".join(
            getattr(block, "text", "") or ""
            for block in message.content
            if getattr(block, "type", None) == "text"
        ).strip()

        if not raw_text:
            raise ValueError("The model returned an empty response.")

        try:
            payload = json.loads(_strip_code_fences(raw_text))
        except json.JSONDecodeError:
            # Fallback: extract JSON object with regex
            match = re.search(r'\{[\s\S]*\}', raw_text)
            if match:
                try:
                    payload = json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            logger.warning("Failed to parse model JSON: %s", raw_text[:500])
            raise ValueError("The model response could not be parsed as JSON. Please retry.")

        if not isinstance(payload, dict):
            raise ValueError("The model response was not a JSON object.")

        return _parse_extraction_payload(payload)
