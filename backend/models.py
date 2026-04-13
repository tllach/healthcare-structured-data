from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal, Any


class Patient(BaseModel):
    name_last: Optional[str] = None
    name_first: Optional[str] = None
    name_mi: Optional[str] = None
    name_full: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class Insurance(BaseModel):
    company: Optional[str] = None
    member_id: Optional[str] = None
    group_number: Optional[str] = None
    plan_name: Optional[str] = None


class RequestingProvider(BaseModel):
    name: Optional[str] = None
    npi: Optional[str] = None
    facility: Optional[str] = None
    tax_id: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    address: Optional[str] = None
    specialty: Optional[str] = None
    license_number: Optional[str] = None


class ReferringProvider(BaseModel):
    name: Optional[str] = None
    npi: Optional[str] = None
    phone: Optional[str] = None


class ServiceRequest(BaseModel):
    type_of_service: Optional[str] = None
    service_setting: Optional[str] = None
    requested_start_date: Optional[str] = None
    requested_end_date: Optional[str] = None
    number_of_sessions: Optional[str] = None
    frequency: Optional[str] = None
    date_of_request: Optional[str] = None


class Diagnosis(BaseModel):
    icd10_code: Optional[str] = None
    description: Optional[str] = None  # Optional so partial extractions don't crash


class Procedure(BaseModel):
    cpt_code: Optional[str] = None
    hcpcs_code: Optional[str] = None
    description: Optional[str] = None  # Optional so partial extractions don't crash


class Medication(BaseModel):
    name: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    prescriber: Optional[str] = None


class AssessmentScore(BaseModel):
    tool: str
    score: str
    date: Optional[str] = None
    interpretation: Optional[str] = None


class LabTest(BaseModel):
    test_name: str
    result: str
    units: Optional[str] = None
    reference_range: Optional[str] = None
    flag: Optional[Literal["HIGH", "LOW", "CRITICAL", "NORMAL"]] = None


class LabPanel(BaseModel):
    panel_name: str
    cpt_code: Optional[str] = None
    collection_date: Optional[str] = None
    tests: list[LabTest] = []


class ClinicalInformation(BaseModel):
    presenting_symptoms: Optional[str] = None
    clinical_history: Optional[str] = None
    treatment_goals: Optional[str] = None
    medical_necessity: Optional[str] = None
    risk_if_not_provided: Optional[str] = None


class Attestation(BaseModel):
    printed_name: Optional[str] = None
    date: Optional[str] = None
    license_number: Optional[str] = None


class Payer(BaseModel):
    name: Optional[str] = None
    fax: Optional[str] = None
    phone: Optional[str] = None


class ConfidenceScores(BaseModel):
    patient: float = 0.0
    insurance: float = 0.0
    requesting_provider: float = 0.0
    referring_provider: float = 0.0
    service_request: float = 0.0
    diagnoses: float = 0.0
    procedures: float = 0.0
    medications: float = 0.0
    lab_results: float = 0.0
    clinical_information: float = 0.0


class ExtractionResult(BaseModel):
    payer: Payer = Field(default_factory=Payer)
    patient: Patient = Field(default_factory=Patient)
    insurance: Insurance = Field(default_factory=Insurance)
    requesting_provider: RequestingProvider = Field(default_factory=RequestingProvider)
    referring_provider: ReferringProvider = Field(default_factory=ReferringProvider)
    service_request: ServiceRequest = Field(default_factory=ServiceRequest)
    diagnoses: list[Diagnosis] = []
    procedures: list[Procedure] = []
    medications: list[Medication] = []
    assessment_scores: list[AssessmentScore] = []
    lab_results: list[LabPanel] = []
    clinical_information: ClinicalInformation = Field(default_factory=ClinicalInformation)
    attestation: Attestation = Field(default_factory=Attestation)
    confidence: ConfidenceScores = Field(default_factory=ConfidenceScores)
    extraction_notes: list[str] = []
    document_type: str = "unknown"


class ExtractionResponse(BaseModel):
    result: ExtractionResult
    processing_time_ms: int
    document_type: str


class ExtractionRecordIn(BaseModel):
    file_name: str
    raw_extracted: dict[str, Any]
    final_submitted: dict[str, Any] | None = None
    corrections: dict[str, Any] = Field(default_factory=dict)
    file_url: str | None = None
    status: str = "submitted"
    document_type: str = "unknown"


class ExtractionRecordOut(BaseModel):
    id: str
    file_name: str
    file_url: str | None = None
    raw_extracted: dict[str, Any]
    final_submitted: dict[str, Any] | None
    corrections: dict[str, Any]
    status: str = "pending"
    created_at: datetime
    document_type: str = "unknown"


class AccuracyStats(BaseModel):
    field_key: str
    total: int
    corrected: int
    accuracy_pct: float


class SectionAccuracyStats(BaseModel):
    section: str
    avg_model_confidence: float
    total_submissions: int
    correction_count: int
    correction_rate: float
    accuracy_rate: float
    calibration_delta: float
