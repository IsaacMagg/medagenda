import type {
  Appointment,
  Clinic,
  Consultation,
  Doctor,
  Invite,
  Member,
  Patient,
} from "@/lib/types";

import type {
  AppointmentRow,
  ClinicInviteRow,
  ClinicMemberRow,
  ClinicRow,
  ConsultationRow,
  DoctorRow,
  PatientRow,
} from "./database.types";

/**
 * Tradução entre as linhas do Postgres (snake_case) e os tipos que as telas
 * usam (camelCase). Concentrar isso aqui evita espalhar nomes de coluna
 * pela interface.
 */

/** O Postgres devolve time como "09:00:00"; a UI trabalha com "09:00". */
function toHHmm(time: string): string {
  return time.slice(0, 5);
}

export function toClinic(row: ClinicRow): Clinic {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    email: row.email,
    phone: row.phone ?? undefined,
  };
}

export function toMember(row: ClinicMemberRow): Member {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function toInvite(row: ClinicInviteRow): Invite {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

export function toDoctor(row: DoctorRow): Doctor {
  return {
    id: row.id,
    name: row.name,
    crm: row.crm,
    specialty: row.specialty,
    createdAt: row.created_at,
  };
}

export function toPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    phone: row.phone,
    email: row.email ?? undefined,
    cpf: row.cpf ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    date: row.scheduled_date,
    time: toHHmm(row.scheduled_time),
    reason: row.reason,
    status: row.status,
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at,
  };
}

export function toConsultation(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    appointmentId: row.appointment_id,
    date: row.occurred_on,
    complaint: row.complaint,
    evolution: row.evolution,
    diagnosis: row.diagnosis,
    prescription: row.prescription,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

type PatientWritable = {
  name: string;
  birth_date: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  address: string | null;
  notes: string | null;
};

/** Campos de paciente alterados no formulário (para update). */
export function patientToRow(
  data: Partial<Patient>
): Partial<PatientWritable> {
  const row: Partial<PatientWritable> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.birthDate !== undefined) row.birth_date = data.birthDate;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email || null;
  if (data.cpf !== undefined) row.cpf = data.cpf || null;
  if (data.address !== undefined) row.address = data.address || null;
  if (data.notes !== undefined) row.notes = data.notes || null;
  return row;
}

/** Paciente novo: os campos obrigatórios sempre vêm preenchidos. */
export function newPatientToRow(
  data: Omit<Patient, "id" | "createdAt" | "updatedAt">,
  clinicId: string
): PatientWritable & { clinic_id: string } {
  return {
    clinic_id: clinicId,
    name: data.name,
    birth_date: data.birthDate,
    phone: data.phone,
    email: data.email || null,
    cpf: data.cpf || null,
    address: data.address || null,
    notes: data.notes || null,
  };
}
