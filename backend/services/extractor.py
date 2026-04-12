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

    def _get_extraction_prompt(self) -> str:
        return """You are a medical data extraction specialist. Extract ALL available information from this clinical document.

Return ONLY a valid JSON object with NO markdown, NO backticks, NO explanation before or after. Start your response with { and end with }.

Use null for missing fields. All values must be strings (never raw numbers).

{
  "payer": {
    "name": "insurance company / payer name or null",
    "fax": "payer fax number or null",
    "phone": "payer phone number or null"
  },

  "patient": {
    "name_last": "last name or null",
    "name_first": "first name or null",
    "name_mi": "middle initial or null",
    "name_full": "full name or null",
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

  "requesting_provider": {
    "name": "provider full name or null",
    "npi": "NPI number (10 digits) or null",
    "facility": "facility/practice/clinic name or null",
    "tax_id": "Tax ID or EIN or null",
    "phone": "phone number or null",
    "fax": "fax number or null",
    "address": "full address or null",
    "specialty": "medical specialty or null",
    "license_number": "state license number or null"
  },

  "referring_provider": {
    "name": "referring provider full name or null",
    "npi": "referring provider NPI or null",
    "phone": "referring provider phone or null"
  },

  "service_request": {
    "type_of_service": "Outpatient | Inpatient | Intensive Outpatient | Partial Hospitalization | Residential | Other | null",
    "service_setting": "clinic/hospital/telehealth, etc. or null",
    "requested_start_date": "requested start date in MM/DD/YYYY format or null",
    "requested_end_date": "requested end date in MM/DD/YYYY format or null",
    "number_of_sessions": "number of sessions or null",
    "frequency": "e.g. 2x per week or null",
    "date_of_request": "date of request in MM/DD/YYYY format or null"
  },

  "diagnoses": [
    {
      "icd10_code": "format X00.0 ",
      "description": "diagnosis description"
    }
  ],

  "procedures": [
    {
      "cpt_code": "exactly 5 digits CPT code or null",
      "hcpcs_code": "HCPCS code or null",
      "description": "procedure description or null"
    }
  ],

  "medications": [
    {
      "name": "medication name",
      "dose": "dose and units or null",
      "frequency": "frequency or null",
      "prescriber": "prescriber name or null"
    }
  ],

  "assessment_scores": [
    {
      "tool": "assessment tool name (e.g. PHQ-9, GAD-7, AUDIT)",
      "score": "score value as string",
      "date": "MM/DD/YYYY or null",
      "interpretation": "score interpretation if present or null"
    }
  ],

  "lab_results": [
    {
      "panel_name": "panel name (e.g. Complete Metabolic Panel)",
      "cpt_code": "CPT code for this panel or null",
      "collection_date": "MM/DD/YYYY or null",
      "tests": [
        {
          "test_name": "test name",
          "result": "result value as string",
          "units": "units or null",
          "reference_range": "reference range as plain string or null",
          "flag": "HIGH | LOW | CRITICAL | NORMAL | null"
        }
      ]
    }
  ],

  "clinical_information": {
    "presenting_symptoms": "presenting symptoms and functional impairment as described or null",
    "clinical_history": "relevant clinical history, prior treatments, response to treatment or null",
    "treatment_goals": "treatment goals and expected outcomes or null",
    "medical_necessity": "justification for medical necessity or null",
    "risk_if_not_provided": "risk if services not approved or null"
  },

  "attestation": {
    "printed_name": "provider printed name or null",
    "date": "MM/DD/YYYY or null",
    "license_number": "license number or null"
  },

  "confidence": {
    "patient": "0.95",
    "insurance": "0.95",
    "requesting_provider": "0.95",
    "referring_provider": "0.95",
    "service_request": "0.95",
    "diagnoses": "0.95",
    "procedures": "0.95",
    "medications": "0.95",
    "lab_results": "0.95",
    "clinical_information": "0.95"
  },

  "extraction_notes": [
    "List any ambiguous fields, unclear handwriting, or assumptions made"
  ],

  "document_type": "clinical_note | referral_letter | insurance_card | lab_results | intake_form | handwritten_note | service_request | unknown"
}

EXTRACTION RULES:
- ICD-10 format: Letter + 2 digits + optional decimal + digits (e.g. F32.1, E11.65, M54.5)
- CPT codes: exactly 5 digits (e.g., 90837, 80053, 83036)
- NPI: exactly 10 digits
- Lab values: always store as strings
- Lab flags: only HIGH, LOW, CRITICAL, or NORMAL
- If a full section is absent from the document: set all fields to null and confidence to 0.0
- Handwritten content: lower confidence + add notes about unclear portions
- Never invent or guess codes — use null if not explicitly present
- For lab documents: include ALL test rows — do not summarize or truncate
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
