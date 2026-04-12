from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Patient(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    dob: str | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None


class Insurance(BaseModel):
    model_config = ConfigDict(extra="ignore")

    company: str | None = None
    member_id: str | None = None
    group_number: str | None = None
    plan_name: str | None = None


class Provider(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    npi: str | None = None
    tax_id: str | None = None
    facility: str | None = None
    phone: str | None = None
    fax: str | None = None
    address: str | None = None
    specialty: str | None = None


class Diagnosis(BaseModel):
    model_config = ConfigDict(extra="ignore")

    icd10_code: str | None = None
    description: str | None = None


class Procedure(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cpt_code: str | None = None
    description: str | None = None


class ConfidenceScores(BaseModel):
    """Per-section confidence; each score is between 0.0 and 1.0."""

    model_config = ConfigDict(extra="ignore")

    patient: float = Field(ge=0.0, le=1.0)
    insurance: float = Field(ge=0.0, le=1.0)
    provider: float = Field(ge=0.0, le=1.0)
    diagnoses: float = Field(ge=0.0, le=1.0)
    procedures: float = Field(ge=0.0, le=1.0)
    medications: float = Field(ge=0.0, le=1.0)
    clinical_history: float = Field(ge=0.0, le=1.0)


class ExtractionResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    patient: Patient = Field(default_factory=Patient)
    insurance: Insurance = Field(default_factory=Insurance)
    provider: Provider = Field(default_factory=Provider)
    diagnoses: list[Diagnosis] = Field(default_factory=list)
    procedures: list[Procedure] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    clinical_history: str | None = None
    confidence: ConfidenceScores = Field(default_factory=lambda: ConfidenceScores(
        patient=0.0,
        insurance=0.0,
        provider=0.0,
        diagnoses=0.0,
        procedures=0.0,
        medications=0.0,
        clinical_history=0.0,
    ))
    extraction_notes: list[str] = Field(default_factory=list)


class ExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    result: ExtractionResult
    processing_time_ms: int
    document_type: str


class ExtractionRecordIn(BaseModel):
    """Payload for saving an extraction (insert). Matches client ExtractionRecord minus id/created_at."""

    model_config = ConfigDict(extra="ignore")

    file_name: str
    raw_extracted: dict[str, Any]
    final_submitted: dict[str, Any] | None = None
    corrections: dict[str, Any] = Field(default_factory=dict)
    file_url: str | None = None
    status: str = "submitted"


class ExtractionRecordOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    file_name: str
    raw_extracted: dict[str, Any]
    final_submitted: dict[str, Any] | None
    corrections: dict[str, Any]
    created_at: datetime


class AccuracyStats(BaseModel):
    model_config = ConfigDict(extra="ignore")

    field_key: str
    total: int
    corrected: int
    accuracy_pct: float
