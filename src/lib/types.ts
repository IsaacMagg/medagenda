export type AppointmentStatus =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "faltou";

/** A clínica. Uma clínica tem várias contas de acesso. */
export type Clinic = {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
};

/**
 * Papel da conta dentro da clínica.
 * - `admin`: faz tudo, inclusive mexer em médicos e excluir pacientes.
 * - `recepcao`: agenda, cadastra e edita pacientes, registra consultas.
 */
export type ClinicRole = "admin" | "recepcao";

/** Uma conta de acesso ligada a uma clínica. */
export type Member = {
  userId: string;
  name: string;
  email: string;
  role: ClinicRole;
  createdAt: string;
};

/** Convite pendente para alguém criar conta dentro da clínica. */
export type Invite = {
  id: string;
  email: string;
  role: ClinicRole;
  createdAt: string;
  acceptedAt: string | null;
};

/** Médico cadastrado pela clínica — não é uma conta de acesso. */
export type Doctor = {
  id: string;
  name: string;
  /**
   * Registro no conselho profissional. O campo se chama `crm` por causa da
   * coluna no banco, mas guarda texto livre: cada especialidade tem seu
   * conselho (CRM, CRO, CRP, CREFITO…).
   */
  crm: string;
  specialty: string;
  createdAt: string;
};

export type Patient = {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  phone: string; // apenas dígitos, com DDI/DDD: 5511999998888
  email?: string;
  cpf?: string;
  address?: string;
  notes?: string;
  createdAt: string; // ISO
  /** Serve de "versão" para detectar edição simultânea. */
  updatedAt: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  /** Qual médico da clínica vai atender. */
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  reason: string;
  status: AppointmentStatus;
  /** ISO da última vez que o lembrete de WhatsApp foi disparado */
  reminderSentAt: string | null;
  createdAt: string;
};

/** Registro clínico do que aconteceu no atendimento. */
export type Consultation = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  date: string; // YYYY-MM-DD
  complaint: string; // queixa / motivo
  evolution: string; // como foi a consulta
  diagnosis: string;
  prescription: string; // conduta / prescrição
  createdAt: string;
  /** Conta que registrou o atendimento (pode ser a recepção). */
  createdBy: string | null;
};
