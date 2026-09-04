/**
 * Tipos das tabelas do Supabase.
 *
 * Escritos à mão para bater com `supabase/migrations/` (0001 + 0002).
 * Quando o esquema mudar, dá para gerar automaticamente com:
 *   npx supabase gen types typescript --project-id tyyycbbivquafoamctyx > src/lib/supabase/database.types.ts
 */

export type AppointmentStatusRow =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "faltou";

export type ClinicRoleRow = "admin" | "recepcao";

export type ClinicRow = {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string | null;
  created_at: string;
};

export type ClinicMemberRow = {
  user_id: string;
  clinic_id: string;
  name: string;
  email: string;
  role: ClinicRoleRow;
  created_at: string;
};

export type ClinicInviteRow = {
  id: string;
  clinic_id: string;
  email: string;
  role: ClinicRoleRow;
  created_at: string;
  accepted_at: string | null;
};

export type DoctorRow = {
  id: string;
  clinic_id: string;
  name: string;
  crm: string;
  specialty: string;
  created_at: string;
};

export type PatientRow = {
  id: string;
  clinic_id: string;
  name: string;
  birth_date: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AppointmentRow = {
  id: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_date: string;
  scheduled_time: string;
  reason: string;
  status: AppointmentStatusRow;
  reminder_sent_at: string | null;
  created_at: string;
};

export type ConsultationRow = {
  id: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_id: string | null;
  occurred_on: string;
  complaint: string;
  evolution: string;
  diagnosis: string;
  prescription: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type PlatformOwnerRow = {
  email: string;
  created_at: string;
};

/** Colunas obrigatórias no insert; o resto tem default ou aceita null. */
type ClinicInsert = {
  /** Opcional desde a 0005: o banco gera o id da clínica. */
  id?: string;
  name: string;
  email: string;
  cnpj?: string;
  phone?: string | null;
  created_at?: string;
};

type DoctorInsert = {
  id?: string;
  clinic_id: string;
  name: string;
  crm?: string;
  specialty?: string;
  created_at?: string;
};

type PatientInsert = {
  id?: string;
  clinic_id: string;
  name: string;
  birth_date: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

type AppointmentInsert = {
  id?: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_date: string;
  scheduled_time: string;
  reason?: string;
  status?: AppointmentStatusRow;
  reminder_sent_at?: string | null;
  created_at?: string;
};

type ConsultationInsert = {
  id?: string;
  clinic_id: string;
  doctor_id: string;
  patient_id: string;
  appointment_id?: string | null;
  occurred_on: string;
  complaint?: string;
  evolution: string;
  diagnosis?: string;
  prescription?: string;
  created_at?: string;
  created_by?: string | null;
};

type ClinicMemberInsert = {
  user_id: string;
  clinic_id: string;
  name?: string;
  email: string;
  role?: ClinicRoleRow;
  created_at?: string;
};

type ClinicInviteInsert = {
  id?: string;
  clinic_id: string;
  email: string;
  role?: ClinicRoleRow;
  created_at?: string;
  accepted_at?: string | null;
};

export type Database = {
  public: {
    Tables: {
      clinics: Table<ClinicRow, ClinicInsert>;
      clinic_members: Table<ClinicMemberRow, ClinicMemberInsert>;
      clinic_invites: Table<ClinicInviteRow, ClinicInviteInsert>;
      platform_owners: Table<PlatformOwnerRow, { email: string }>;
      doctors: Table<DoctorRow, DoctorInsert>;
      patients: Table<PatientRow, PatientInsert>;
      appointments: Table<AppointmentRow, AppointmentInsert>;
      consultations: Table<ConsultationRow, ConsultationInsert>;
    };
    Views: Record<never, never>;
    Functions: {
      current_clinic_id: { Args: Record<never, never>; Returns: string };
      is_clinic_admin: { Args: Record<never, never>; Returns: boolean };
      is_platform_owner: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: {
      appointment_status: AppointmentStatusRow;
      clinic_role: ClinicRoleRow;
    };
    CompositeTypes: Record<never, never>;
  };
};
