"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { BarChart2, Building2, Clipboard, ClipboardList, FileText, FlaskConical, 
  PenLine, Pill, Plus, ShieldCheck, Stethoscope, Trash2, User, UserCheck } from "lucide-react";
import { Badge, Button, Input, SectionCard } from "@/components/ui";
import type { AssessmentScore, Diagnosis, ExtractionResult, Medication, Procedure } from "@/lib/types";
import { computeCorrections, countStats } from "@/lib/utils";

const SERVICE_TYPE_OPTIONS = [
  "Outpatient",
  "Inpatient",
  "Intensive Outpatient",
  "Partial Hospitalization",
  "Residential",
  "Other",
] as const;

function fieldConfidenceClass(confidence: number | undefined): string {
  if (confidence === undefined || confidence === 0) {
    return "border border-gray-300 bg-white";
  }
  if (confidence >= 0.85) {
    return "border border-gray-300 border-l-4 border-l-green-400 bg-green-50";
  }
  if (confidence >= 0.6) {
    return "border border-gray-300 border-l-4 border-l-yellow-400 bg-yellow-50";
  }
  return "border border-gray-300 border-l-4 border-l-red-400 bg-red-50";
}

function initialOpenSections(d: ExtractionResult): Record<string, boolean> {
  const c = d.confidence;
  return {
    member: c.patient < 0.85 || c.patient === 0,
    requesting: c.requesting_provider < 0.85 || c.requesting_provider === 0,
    referring: c.referring_provider < 0.85 || c.referring_provider === 0,
    service: c.service_request < 0.85 || c.service_request === 0,
    clinical: c.clinical_information < 0.85 || c.clinical_information === 0,
    justification: c.clinical_information < 0.85 || c.clinical_information === 0,
    attestation: c.requesting_provider < 0.85 || c.requesting_provider === 0,
    diagnoses: c.diagnoses < 0.85 || c.diagnoses === 0,
    procedures: c.procedures < 0.85 || c.procedures === 0,
    medications: c.medications < 0.85 || c.medications === 0,
    scores: c.clinical_information < 0.85 || c.clinical_information === 0,
    labs: c.lab_results < 0.85 || c.lab_results === 0,
  };
}

export interface ExtractionFormProps {
  data: {
    result: ExtractionResult;
    document_type: string;
  };
  fileName: string;
  onSubmit: (
    finalData: ExtractionResult,
    corrections: Record<string, { original: unknown; corrected: unknown }>
  ) => void;
  isSubmitting: boolean;
}

export function ExtractionForm({ data, fileName, onSubmit, isSubmitting }: ExtractionFormProps) {
  const [formData, setFormData] = useState<ExtractionResult>( () => structuredClone(data.result) );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>( () => initialOpenSections(data.result) );

  function updateField<T extends keyof ExtractionResult>( section: T, field: string, value: unknown ) {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        [field]: value,
      },
    }));
  }

  function resetToAi() {
    setFormData(structuredClone(data.result));
  }

  function addDiagnosis() {
    setFormData((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { icd10_code: null, description: "" }],
    }));
  }

  function removeDiagnosis(index: number) {
    setFormData((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.filter((_, i) => i !== index),
    }));
  }

  function updateDiagnosis( index: number, field: keyof Diagnosis, value: string | null ) {
    setFormData((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.map((d, i) =>
        i === index
          ? {
              ...d,
              [field]:
                field === "description" ? (value ?? "") : value,
            }
          : d
      ),
    }));
  }

  function addProcedure() {
    setFormData((prev) => ({
      ...prev,
      procedures: [
        ...prev.procedures,
        { cpt_code: null, hcpcs_code: null, description: "" },
      ],
    }));
  }

  function removeProcedure(index: number) {
    setFormData((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((_, i) => i !== index),
    }));
  }

  function updateProcedure( index: number, field: keyof Procedure, value: string | null ) {
    setFormData((prev) => ({
      ...prev,
      procedures: prev.procedures.map((p, i) =>
        i === index
          ? {
              ...p,
              [field]:
                field === "description" ? (value ?? "") : value,
            }
          : p
      ),
    }));
  }

  function addMedication() {
    setFormData((prev) => ({
      ...prev,
      medications: [
        ...prev.medications,
        { name: "", dose: null, frequency: null, prescriber: null },
      ],
    }));
  }

  function removeMedication(index: number) {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  }

  function updateMedication( index: number, field: keyof Medication, value: string | null ) {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.map((m, i) =>
        i === index
          ? {
              ...m,
              [field]:
                field === "name" ? (value ?? "") : value,
            }
          : m
      ),
    }));
  }

  function addAssessmentScore() {
    setFormData((prev) => ({
      ...prev,
      assessment_scores: [
        ...prev.assessment_scores,
        { tool: "", score: "", date: null, interpretation: null },
      ],
    }));
  }

  function removeAssessmentScore(index: number) {
    setFormData((prev) => ({
      ...prev,
      assessment_scores: prev.assessment_scores.filter((_, i) => i !== index),
    }));
  }

  function updateAssessmentScore( index: number, field: keyof AssessmentScore, value: string | null ) {
    setFormData((prev) => ({
      ...prev,
      assessment_scores: prev.assessment_scores.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      ),
    }));
  }

  function handleSaveSubmit() {
    const corrections = computeCorrections(data.result, formData);
    onSubmit(formData, corrections);
  }

  const stats = countStats(formData, data.result.confidence);
  const patientConf = data.result.confidence.patient;
  const insuranceConf = data.result.confidence.insurance;
  const reqConf = data.result.confidence.requesting_provider;
  const refConf = data.result.confidence.referring_provider;
  const svcConf = data.result.confidence.service_request;
  const clinicalConf = data.result.confidence.clinical_information;
  const diagConf = data.result.confidence.diagnoses;
  const procConf = data.result.confidence.procedures;
  const medConf = data.result.confidence.medications;
  const scoresConf = data.result.confidence.clinical_information;
  const labConf = data.result.confidence.lab_results;

  const typeNorm = (formData.service_request.type_of_service ?? "").trim();
  const typeSelected = (opt: string) =>
    typeNorm.toLowerCase() === opt.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 max-w-[min(100%,20rem)] items-center gap-2 sm:max-w-md">
            <span className="truncate font-medium text-gray-900" title={fileName}>
              {fileName}
            </span>
            <Badge variant="info" label={formData.document_type} />
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
            <Badge
              variant="success"
              label={`${stats.autoFilled} auto-filled`}
            />
            <Badge
              variant="warning"
              label={`${stats.needsReview} need review`}
            />
            <Badge variant="neutral" label={`${stats.notFound} not found`} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" onClick={resetToAi}>
              Reset to AI values
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={handleSaveSubmit}
            >
              Save & Submit
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 pb-28 sm:px-6">
        <SectionCard
          title="Member Information"
          icon={<User className="h-5 w-5" />}
          confidence={data.result.confidence.patient}
          open={openSections.member}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, member: o }))
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Member Name Last"
              value={formData.patient.name_last ?? ""}
              onChange={(e) =>
                updateField("patient", "name_last", e.target.value || null)
              }
              confidence={patientConf}
            />
            <Input
              label="Member Name First"
              value={formData.patient.name_first ?? ""}
              onChange={(e) =>
                updateField("patient", "name_first", e.target.value || null)
              }
              confidence={patientConf}
            />
            <Input
              label="Middle Initial"
              value={formData.patient.name_mi ?? ""}
              onChange={(e) =>
                updateField("patient", "name_mi", e.target.value || null)
              }
              confidence={patientConf}
            />
            <Input
              label="Date of Birth"
              value={formData.patient.dob ?? ""}
              onChange={(e) =>
                updateField("patient", "dob", e.target.value || null)
              }
              hint="MM/DD/YYYY"
              confidence={patientConf}
            />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                className={clsx(
                  "w-full rounded-lg px-3 py-2 text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                  fieldConfidenceClass(patientConf)
                )}
                value={formData.patient.gender ?? ""}
                onChange={(e) =>
                  updateField(
                    "patient",
                    "gender",
                    e.target.value ? e.target.value : null
                  )
                }
              >
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Input
              label="Member ID"
              value={formData.insurance.member_id ?? ""}
              onChange={(e) =>
                updateField("insurance", "member_id", e.target.value || null)
              }
              confidence={insuranceConf}
            />
            <Input
              label="Group Number"
              value={formData.insurance.group_number ?? ""}
              onChange={(e) =>
                updateField(
                  "insurance",
                  "group_number",
                  e.target.value || null
                )
              }
              confidence={insuranceConf}
            />
            <Input
              label="Phone"
              value={formData.patient.phone ?? ""}
              onChange={(e) =>
                updateField("patient", "phone", e.target.value || null)
              }
              confidence={patientConf}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={formData.patient.address ?? ""}
                onChange={(e) =>
                  updateField("patient", "address", e.target.value || null)
                }
                multiline
                rows={2}
                confidence={patientConf}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Requesting Provider"
          icon={<Building2 className="h-5 w-5" />}
          confidence={data.result.confidence.requesting_provider}
          open={openSections.requesting}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, requesting: o }))
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Provider Name"
              value={formData.requesting_provider.name ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "name",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <Input
              label="NPI"
              value={formData.requesting_provider.npi ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "npi",
                  e.target.value || null
                )
              }
              hint="10-digit NPI number"
              confidence={reqConf}
            />
            <Input
              label="Facility / Practice Name"
              value={formData.requesting_provider.facility ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "facility",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <Input
              label="Tax ID"
              value={formData.requesting_provider.tax_id ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "tax_id",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <Input
              label="Phone"
              value={formData.requesting_provider.phone ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "phone",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <Input
              label="Fax"
              value={formData.requesting_provider.fax ?? ""}
              onChange={(e) =>
                updateField(
                  "requesting_provider",
                  "fax",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={formData.requesting_provider.address ?? ""}
                onChange={(e) =>
                  updateField(
                    "requesting_provider",
                    "address",
                    e.target.value || null
                  )
                }
                multiline
                rows={2}
                confidence={reqConf}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Referring Provider"
          icon={<UserCheck className="h-5 w-5" />}
          confidence={data.result.confidence.referring_provider}
          open={openSections.referring}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, referring: o }))
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Referring Provider Name"
              value={formData.referring_provider.name ?? ""}
              onChange={(e) =>
                updateField(
                  "referring_provider",
                  "name",
                  e.target.value || null
                )
              }
              confidence={refConf}
            />
            <Input
              label="Referring Provider NPI"
              value={formData.referring_provider.npi ?? ""}
              onChange={(e) =>
                updateField(
                  "referring_provider",
                  "npi",
                  e.target.value || null
                )
              }
              confidence={refConf}
            />
            <Input
              label="Phone"
              value={formData.referring_provider.phone ?? ""}
              onChange={(e) =>
                updateField(
                  "referring_provider",
                  "phone",
                  e.target.value || null
                )
              }
              confidence={refConf}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Service Information"
          icon={<ClipboardList className="h-5 w-5" />}
          confidence={data.result.confidence.service_request}
          open={openSections.service}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, service: o }))
          }
        >
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-gray-700">
                Type of Service
              </legend>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      updateField("service_request", "type_of_service", opt)
                    }
                    className={clsx(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      typeSelected(opt)
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Service Setting"
                value={formData.service_request.service_setting ?? ""}
                onChange={(e) =>
                  updateField(
                    "service_request",
                    "service_setting",
                    e.target.value || null
                  )
                }
                confidence={svcConf}
              />
              <Input
                label="Requested Start Date"
                value={formData.service_request.requested_start_date ?? ""}
                onChange={(e) =>
                  updateField(
                    "service_request",
                    "requested_start_date",
                    e.target.value || null
                  )
                }
                confidence={svcConf}
              />
              <Input
                label="Requested End Date"
                value={formData.service_request.requested_end_date ?? ""}
                onChange={(e) =>
                  updateField(
                    "service_request",
                    "requested_end_date",
                    e.target.value || null
                  )
                }
                confidence={svcConf}
              />
              <Input
                label="Number of Sessions"
                value={formData.service_request.number_of_sessions ?? ""}
                onChange={(e) =>
                  updateField(
                    "service_request",
                    "number_of_sessions",
                    e.target.value || null
                  )
                }
                confidence={svcConf}
              />
              <Input
                label="Frequency"
                value={formData.service_request.frequency ?? ""}
                onChange={(e) =>
                  updateField(
                    "service_request",
                    "frequency",
                    e.target.value || null
                  )
                }
                confidence={svcConf}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Clinical Information"
          icon={<FileText className="h-5 w-5" />}
          confidence={data.result.confidence.clinical_information}
          open={openSections.clinical}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, clinical: o }))
          }
        >
          <div className="space-y-4">
            <Input
              label="Presenting Symptoms"
              value={formData.clinical_information.presenting_symptoms ?? ""}
              onChange={(e) =>
                updateField(
                  "clinical_information",
                  "presenting_symptoms",
                  e.target.value || null
                )
              }
              multiline
              rows={4}
              confidence={clinicalConf}
            />
            <Input
              label="Clinical History"
              value={formData.clinical_information.clinical_history ?? ""}
              onChange={(e) =>
                updateField(
                  "clinical_information",
                  "clinical_history",
                  e.target.value || null
                )
              }
              multiline
              rows={4}
              confidence={clinicalConf}
            />
            <Input
              label="Treatment Goals"
              value={formData.clinical_information.treatment_goals ?? ""}
              onChange={(e) =>
                updateField(
                  "clinical_information",
                  "treatment_goals",
                  e.target.value || null
                )
              }
              multiline
              rows={3}
              confidence={clinicalConf}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Clinical Justification"
          icon={<ShieldCheck className="h-5 w-5" />}
          confidence={data.result.confidence.clinical_information}
          open={openSections.justification}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, justification: o }))
          }
        >
          <div className="space-y-4">
            <Input
              label="Medical Necessity"
              value={formData.clinical_information.medical_necessity ?? ""}
              onChange={(e) =>
                updateField(
                  "clinical_information",
                  "medical_necessity",
                  e.target.value || null
                )
              }
              multiline
              rows={4}
              confidence={clinicalConf}
            />
            <Input
              label="Risk if Not Provided"
              value={
                formData.clinical_information.risk_if_not_provided ?? ""
              }
              onChange={(e) =>
                updateField(
                  "clinical_information",
                  "risk_if_not_provided",
                  e.target.value || null
                )
              }
              multiline
              rows={3}
              confidence={clinicalConf}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Attestation"
          icon={<PenLine className="h-5 w-5" />}
          confidence={data.result.confidence.requesting_provider}
          open={openSections.attestation}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, attestation: o }))
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Printed Name"
              value={formData.attestation.printed_name ?? ""}
              onChange={(e) =>
                updateField(
                  "attestation",
                  "printed_name",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
            <Input
              label="Date"
              value={formData.attestation.date ?? ""}
              onChange={(e) =>
                updateField("attestation", "date", e.target.value || null)
              }
              confidence={reqConf}
            />
            <Input
              label="License #"
              value={formData.attestation.license_number ?? ""}
              onChange={(e) =>
                updateField(
                  "attestation",
                  "license_number",
                  e.target.value || null
                )
              }
              confidence={reqConf}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Diagnoses"
          icon={<Stethoscope className="h-5 w-5" />}
          confidence={data.result.confidence.diagnoses}
          open={openSections.diagnoses}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, diagnoses: o }))
          }
        >
          <div className="space-y-4">
            {formData.diagnoses.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
              >
                <div className="w-32 shrink-0">
                  <Input
                    label="ICD-10 Code"
                    value={row.icd10_code ?? ""}
                    onChange={(e) =>
                      updateDiagnosis(i, "icd10_code", e.target.value || null)
                    }
                    confidence={diagConf}
                  />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <Input
                    label="Description"
                    value={row.description}
                    onChange={(e) =>
                      updateDiagnosis(i, "description", e.target.value)
                    }
                    confidence={diagConf}
                  />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="mb-0.5 shrink-0"
                  aria-label="Remove diagnosis"
                  onClick={() => removeDiagnosis(i)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="gap-1"
              onClick={addDiagnosis}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Diagnosis
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Procedures"
          icon={<Clipboard className="h-5 w-5" />}
          confidence={data.result.confidence.procedures}
          open={openSections.procedures}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, procedures: o }))
          }
        >
          <div className="space-y-4">
            {formData.procedures.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
              >
                <div className="w-32 shrink-0">
                  <Input
                    label="CPT Code"
                    value={row.cpt_code ?? ""}
                    onChange={(e) =>
                      updateProcedure(i, "cpt_code", e.target.value || null)
                    }
                    confidence={procConf}
                  />
                </div>
                <div className="w-32 shrink-0">
                  <Input
                    label="HCPCS Code"
                    value={row.hcpcs_code ?? ""}
                    onChange={(e) =>
                      updateProcedure(i, "hcpcs_code", e.target.value || null)
                    }
                    confidence={procConf}
                  />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <Input
                    label="Description"
                    value={row.description}
                    onChange={(e) =>
                      updateProcedure(i, "description", e.target.value)
                    }
                    confidence={procConf}
                  />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="mb-0.5 shrink-0"
                  aria-label="Remove procedure"
                  onClick={() => removeProcedure(i)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="gap-1"
              onClick={addProcedure}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Procedure
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Medications"
          icon={<Pill className="h-5 w-5" />}
          confidence={data.result.confidence.medications}
          open={openSections.medications}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, medications: o }))
          }
        >
          <div className="space-y-4">
            {formData.medications.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
              >
                <div className="min-w-[8rem] flex-1">
                  <Input
                    label="Medication Name"
                    value={row.name}
                    onChange={(e) =>
                      updateMedication(i, "name", e.target.value)
                    }
                    confidence={medConf}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <Input
                    label="Dose"
                    value={row.dose ?? ""}
                    onChange={(e) =>
                      updateMedication(i, "dose", e.target.value || null)
                    }
                    confidence={medConf}
                  />
                </div>
                <div className="w-36 shrink-0">
                  <Input
                    label="Frequency"
                    value={row.frequency ?? ""}
                    onChange={(e) =>
                      updateMedication(i, "frequency", e.target.value || null)
                    }
                    confidence={medConf}
                  />
                </div>
                <div className="w-40 shrink-0">
                  <Input
                    label="Prescriber"
                    value={row.prescriber ?? ""}
                    onChange={(e) =>
                      updateMedication(i, "prescriber", e.target.value || null)
                    }
                    confidence={medConf}
                  />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="mb-0.5 shrink-0"
                  aria-label="Remove medication"
                  onClick={() => removeMedication(i)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="gap-1"
              onClick={addMedication}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Medication
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Assessment Scores"
          icon={<BarChart2 className="h-5 w-5" />}
          confidence={data.result.confidence.clinical_information}
          open={openSections.scores}
          onOpenChange={(o) =>
            setOpenSections((s) => ({ ...s, scores: o }))
          }
        >
          <div className="space-y-4">
            {formData.assessment_scores.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
              >
                <div className="min-w-[8rem] flex-1">
                  <Input
                    label="Tool Name"
                    value={row.tool}
                    onChange={(e) =>
                      updateAssessmentScore(i, "tool", e.target.value)
                    }
                    confidence={scoresConf}
                  />
                </div>
                <div className="w-20 shrink-0">
                  <Input
                    label="Score"
                    value={row.score}
                    onChange={(e) =>
                      updateAssessmentScore(i, "score", e.target.value)
                    }
                    confidence={scoresConf}
                  />
                </div>
                <div className="w-36 shrink-0">
                  <Input
                    label="Date"
                    value={row.date ?? ""}
                    onChange={(e) =>
                      updateAssessmentScore(i, "date", e.target.value || null)
                    }
                    confidence={scoresConf}
                  />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <Input
                    label="Interpretation"
                    value={row.interpretation ?? ""}
                    onChange={(e) =>
                      updateAssessmentScore(
                        i,
                        "interpretation",
                        e.target.value || null
                      )
                    }
                    confidence={scoresConf}
                  />
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="mb-0.5 shrink-0"
                  aria-label="Remove assessment score"
                  onClick={() => removeAssessmentScore(i)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="gap-1"
              onClick={addAssessmentScore}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Score
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Lab Results"
          icon={<FlaskConical className="h-5 w-5" />}
          confidence={data.result.confidence.lab_results}
          open={openSections.labs}
          onOpenChange={(o) => setOpenSections((s) => ({ ...s, labs: o }))}
        >
          {formData.lab_results.length === 0 || labConf === 0 ? (
            <p className="text-sm text-gray-500">
              No lab results found in this document
            </p>
          ) : (
            <div className="space-y-4">
              {formData.lab_results.map((panel, pi) => (
                <div
                  key={pi}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/50"
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
                    <span className="font-semibold text-gray-900">
                      {panel.panel_name}
                    </span>
                    {panel.cpt_code ? (
                      <Badge variant="neutral" label={panel.cpt_code} />
                    ) : null}
                    <span className="text-sm text-gray-500">
                      {panel.collection_date ?? "—"}
                    </span>
                  </div>
                  <div className="overflow-x-auto px-2 py-2">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs font-medium text-gray-500">
                          <th className="px-2 py-2">Test</th>
                          <th className="px-2 py-2">Result</th>
                          <th className="px-2 py-2">Units</th>
                          <th className="px-2 py-2">Ref Range</th>
                          <th className="px-2 py-2">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {panel.tests.map((t, ti) => (
                          <tr
                            key={ti}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="px-2 py-2 text-gray-900">
                              {t.test_name}
                            </td>
                            <td className="px-2 py-2 text-gray-900">
                              {t.result}
                            </td>
                            <td className="px-2 py-2 text-gray-600">
                              {t.units ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-gray-600">
                              {t.reference_range ?? "—"}
                            </td>
                            <td className="px-2 py-2">
                              {t.flag === "HIGH" || t.flag === "CRITICAL" ? (
                                <Badge variant="error" label={t.flag} />
                              ) : t.flag === "LOW" ? (
                                <Badge variant="warning" label={t.flag} />
                              ) : t.flag === "NORMAL" ? (
                                <Badge variant="success" label={t.flag} />
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Button type="button" variant="ghost" onClick={resetToAi}>
            Reset to AI values
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSaveSubmit}
          >
            Save & Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
