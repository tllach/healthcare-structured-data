export interface Patient {
  name_last: string | null
  name_first: string | null
  name_mi: string | null
  name_full: string | null
  dob: string | null
  gender: string | null
  phone: string | null
  address: string | null
}

export interface Insurance {
  company: string | null
  member_id: string | null
  group_number: string | null
  plan_name: string | null
}

export interface RequestingProvider {
  name: string | null
  npi: string | null
  facility: string | null
  tax_id: string | null
  phone: string | null
  fax: string | null
  address: string | null
  specialty: string | null
  license_number: string | null
}

export interface ReferringProvider {
  name: string | null
  npi: string | null
  phone: string | null
}

export interface ServiceRequest {
  type_of_service: string | null
  service_setting: string | null
  requested_start_date: string | null
  requested_end_date: string | null
  number_of_sessions: string | null
  frequency: string | null
  date_of_request: string | null
}

export interface Diagnosis {
  icd10_code: string | null
  description: string
}

export interface Procedure {
  cpt_code: string | null
  hcpcs_code: string | null
  description: string
}

export interface Medication {
  name: string
  dose: string | null
  frequency: string | null
  prescriber: string | null
}

export interface AssessmentScore {
  tool: string
  score: string
  date: string | null
  interpretation: string | null
}

export interface LabTest {
  test_name: string
  result: string
  units: string | null
  reference_range: string | null
  flag: 'HIGH' | 'LOW' | 'CRITICAL' | 'NORMAL' | null
}

export interface LabPanel {
  panel_name: string
  cpt_code: string | null
  collection_date: string | null
  tests: LabTest[]
}

export interface ClinicalInformation {
  presenting_symptoms: string | null
  clinical_history: string | null
  treatment_goals: string | null
  medical_necessity: string | null
  risk_if_not_provided: string | null
}

export interface Attestation {
  printed_name: string | null
  date: string | null
  license_number: string | null
}

export interface Payer {
  name: string | null
  fax: string | null
  phone: string | null
}

export interface ConfidenceScores {
  patient: number
  insurance: number
  requesting_provider: number
  referring_provider: number
  service_request: number
  diagnoses: number
  procedures: number
  medications: number
  lab_results: number
  clinical_information: number
}

export interface ExtractionResult {
  payer: Payer
  patient: Patient
  insurance: Insurance
  requesting_provider: RequestingProvider
  referring_provider: ReferringProvider
  service_request: ServiceRequest
  diagnoses: Diagnosis[]
  procedures: Procedure[]
  medications: Medication[]
  assessment_scores: AssessmentScore[]
  lab_results: LabPanel[]
  clinical_information: ClinicalInformation
  attestation: Attestation
  confidence: ConfidenceScores
  extraction_notes: string[]
  document_type: string
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ExtractionRecord {
  id: string
  file_name: string
  file_url?: string
  raw_extracted: ExtractionResult
  final_submitted: ExtractionResult | null
  corrections: Record<string, { original: unknown; corrected: unknown }>
  status: 'pending' | 'reviewed' | 'submitted'
  created_at: string
}

export interface AccuracyStats {
  field_key: string
  total: number
  corrected: number
  accuracy_pct: number
}