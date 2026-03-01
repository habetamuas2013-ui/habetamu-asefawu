export interface Patient {
  id: number;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  contact: string;
  patient_type: 'New' | 'Repeat';
  conditions: string;
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  treatment_type?: string;
  diabetes_type?: string;
  cvd_risk?: string;
  cvd_treatment_type?: string;
  created_at: string;
  last_visit?: string;
}

export interface Visit {
  id: number;
  patient_id: number;
  visit_date: string;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate?: number;
  temperature?: number;
  respiratory_rate?: number;
  spo2?: number;
  blood_sugar_level: number;
  hba1c?: number;
  creatinine?: number;
  cholesterol?: number;
  triglycerides?: number;
  urinalysis?: string;
  weight: number;
  notes?: string;
  complications?: string;
  patient_name?: string;
}

export interface ReportSummary {
  totalPatients: number;
  newPatients: number;
  repeatPatients: number;
  conditionCounts: {
    hypertension_only: number;
    diabetes_only: number;
    both: number;
  };
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  genderByCondition: {
    hypertension: { male: number; female: number; other: number };
    diabetes: { male: number; female: number; other: number };
  };
  recentVisits: Visit[];
}
