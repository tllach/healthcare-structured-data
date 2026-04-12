from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic

from models import ConfidenceScores, ExtractionResult, Patient, Insurance, Provider, Diagnosis, Procedure

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
        "patient",
        "insurance",
        "provider",
        "diagnoses",
        "procedures",
        "medications",
        "clinical_history",
    )
    out: dict[str, float] = {k: 0.0 for k in keys}
    if not isinstance(raw, dict):
        return out
    for k in keys:
        v = raw.get(k)
        try:
            if v is None:
                out[k] = 0.0
            else:
                f = float(v)
                out[k] = max(0.0, min(1.0, f))
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _parse_extraction_payload(data: dict[str, Any]) -> tuple[ExtractionResult, str]:
    document_type = "unknown"
    if "document_type" in data and data["document_type"] is not None:
        document_type = str(data["document_type"]).strip() or "unknown"

    conf_dict = _normalize_confidence(data.get("confidence"))
    confidence = ConfidenceScores.model_validate(conf_dict)

    meds = data.get("medications") or []
    if isinstance(meds, list):
        medications: list[str] = []
        for m in meds:
            if isinstance(m, str):
                medications.append(m)
            elif isinstance(m, dict):
                medications.append(json.dumps(m, ensure_ascii=False))
            else:
                medications.append(str(m))
    else:
        medications = []

    notes = data.get("extraction_notes") or []
    extraction_notes = [str(n) for n in notes] if isinstance(notes, list) else []

    patient = Patient.model_validate(data.get("patient") or {})
    insurance = Insurance.model_validate(data.get("insurance") or {})
    provider = Provider.model_validate(data.get("provider") or {})

    diagnoses_raw = data.get("diagnoses") or []
    diagnoses = (
        [Diagnosis.model_validate(x) for x in diagnoses_raw]
        if isinstance(diagnoses_raw, list)
        else []
    )

    procedures_raw = data.get("procedures") or []
    procedures = (
        [Procedure.model_validate(x) for x in procedures_raw]
        if isinstance(procedures_raw, list)
        else []
    )

    ch = data.get("clinical_history")
    clinical_history = None if ch is None else str(ch)

    result = ExtractionResult(
        patient=patient,
        insurance=insurance,
        provider=provider,
        diagnoses=diagnoses,
        procedures=procedures,
        medications=medications,
        clinical_history=clinical_history,
        confidence=confidence,
        extraction_notes=extraction_notes,
    )
    return result, document_type


class DocumentExtractor:
    def __init__(self) -> None:
        self.client = AsyncAnthropic()

    def _get_extraction_prompt(self) -> str:
        return """You are a medical data extraction specialist. Extract ALL available information from this clinical document.

Return ONLY a valid JSON object with NO markdown, no explanation, no backticks. Use null for missing fields.

{
  "patient": {
    "name": "full name or null",
    "dob": "MM/DD/YYYY or null", 
    "gender": "Male/Female/Other or null",
    "phone": "formatted phone or null",
    "address": "full address or null"
  },
  "insurance": {
    "company": "insurance company name or null",
    "member_id": "member ID or null",
    "group_number": "group number or null",
    "plan_name": "plan name or null"
  },
  "provider": {
    "name": "provider full name or null",
    "npi": "NPI number (10 digits) or null",
    "facility": "facility/clinic name or null",
    "phone": "provider phone or null",
    "specialty": "medical specialty or null"
  },
  "diagnoses": [
    { "icd10_code": "format X00.0 or null", "description": "diagnosis description" }
  ],
  "procedures": [
    { "cpt_code": "5-digit CPT code or null", "description": "procedure description" }
  ],
  "medications": ["medication name dosage frequency"],
  "clinical_history": "relevant clinical history summary or null",
  "confidence": {
    "patient": 0.95,
    "insurance": 0.80,
    "provider": 0.90,
    "diagnoses": 0.85,
    "procedures": 0.75,
    "medications": 0.70,
    "clinical_history": 0.60
  },
  "extraction_notes": ["Note any ambiguous fields", "Flag unclear handwriting sections"],
  "document_type": "clinical_note | referral_letter | insurance_card | lab_results | intake_form | handwritten_note | service_request | unknown"
}

Rules:
- ICD-10 codes follow pattern: Letter + 2 digits + optional decimal + more digits (e.g., F32.1, M54.5)
- CPT codes are exactly 5 digits (e.g., 90837, 99213)
- NPI numbers are exactly 10 digits
- For handwritten content, lower confidence scores and add notes about unclear sections
- If a whole section is missing from the document, set confidence to 0.0
- Never invent or guess codes — use null if not explicitly present
"""

    def _build_content_blocks(self, file_content: bytes, media_type: str) -> list[dict[str, Any]]:
        b64 = base64.standard_b64encode(file_content).decode("ascii")
        prompt = self._get_extraction_prompt()

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

    async def extract(
        self, file_content: bytes, media_type: str
    ) -> tuple[ExtractionResult, str]:
        content_blocks = self._build_content_blocks(file_content, media_type)

        try:
            message = await self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=2000,
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

        text_parts: list[str] = []
        for block in message.content:
            if getattr(block, "type", None) == "text":
                text_parts.append(getattr(block, "text", "") or "")

        raw_text = "".join(text_parts).strip()
        if not raw_text:
            raise ValueError("The model returned an empty response.")

        try:
            cleaned = _strip_code_fences(raw_text)
            payload = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse model JSON: %s", raw_text[:500])
            raise ValueError(
                "The model response could not be parsed as JSON. Please retry with a clearer scan."
            ) from e

        if not isinstance(payload, dict):
            raise ValueError("The model response was not a JSON object.")

        return _parse_extraction_payload(payload)
