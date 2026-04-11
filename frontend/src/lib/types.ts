export type ConfidenceLevel = "high" | "medium" | "low";

export interface Patient {
  name: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
}

export interface Insurance {
  company: string;
  member_id: string;
  group_number: string;
  plan_name: string;
}

export interface Provider {
  name: string;
  npi: string;
  tax_id: string;
  facility: string;
  phone: string;
  fax: string;
  address: string;
  specialty: string;
}

export interface referringProvider {
  name: string;
  npi: string;
  phone: string;
}

export interface Diagnosis {
  icd10_code: string;
  description: string;
}

export interface Procedure {
  cpt_code: string;
  description: string;
}

export type serviceType = "inpatient" | "outpatient" | "intensive_outpatient" | "partial_hospitalization" | "residental" | "other";


export interface service extends Diagnosis, Procedure {
  type: serviceType;
  setting: string;
  requested_start_date: string;
  requested_end_date: string;
  number_of_sessions_or_units: number;
  frequency: string;
}

export interface ExtractionResult {
  patient: Patient;
  insurance: Insurance;
  provider: Provider;
  diagnoses: Diagnosis[];
  procedures: Procedure[];
  medications: Array<Record<string, unknown>>;
  clinical_history: string;
  confidence: Record<string, number>;
}

export interface ExtractionRecord {
  id: string;
  file_name: string;
  raw_extracted: ExtractionResult;
  final_submitted: ExtractionResult;
  corrections: Record<string, { original: unknown; corrected: unknown }>;
  created_at: string;
}
