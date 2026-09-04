"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import {
  toAppointment,
  toClinic,
  toConsultation,
  toDoctor,
  toInvite,
  toMember,
  toPatient,
  patientToRow,
  newPatientToRow,
} from "@/lib/supabase/mappers";
import { today } from "./format";
import type {
  Appointment,
  AppointmentStatus,
  Clinic,
  ClinicRole,
  Consultation,
  Doctor,
  Invite,
  Member,
  Patient,
} from "./types";

/**
 * Camada de dados do app — falando com o Supabase.
 *
 * A conta logada é a CLÍNICA. Ela carrega seus médicos, pacientes,
 * agendamentos e consultas uma vez e mantém uma cópia em memória para as
 * telas lerem sem esperar. Toda escrita vai ao banco primeiro e só depois
 * atualiza o estado local. O RLS garante, do lado do servidor, que uma
 * clínica nunca enxerga dados de outra.
 */

type StoreValue = {
  loading: boolean;
  /** Mensagem de erro de carregamento (ex.: migração ainda não rodou). */
  error: string | null;
  clinic: Clinic | null;
  /** A conta logada dentro da clínica. */
  member: Member | null;
  /** Atalho: a conta logada é administradora da clínica? */
  isAdmin: boolean;
  /** A conta logada é o dono da plataforma (quem cadastra clínicas). */
  isPlatformOwner: boolean;
  members: Member[];
  invites: Invite[];
  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  consultations: Consultation[];

  refresh: () => Promise<void>;
  signOut: () => Promise<void>;

  inviteMember: (
    email: string,
    role: ClinicRole
  ) => Promise<{ ok: boolean; message?: string }>;
  revokeInvite: (id: string) => Promise<boolean>;
  setMemberRole: (userId: string, role: ClinicRole) => Promise<boolean>;
  removeMember: (userId: string) => Promise<{ ok: boolean; message?: string }>;

  getDoctor: (id: string) => Doctor | undefined;
  doctorName: (id: string) => string;
  /** Nome da conta que registrou algo — para a autoria da consulta. */
  memberName: (userId: string | null) => string | null;
  getPatient: (id: string) => Patient | undefined;
  appointmentsOf: (patientId: string) => Appointment[];
  consultationsOf: (patientId: string) => Consultation[];
  /** Consultas em que o paciente não apareceu, da mais recente para trás. */
  missedOf: (patientId: string) => Appointment[];
  todayAppointments: () => Appointment[];

  addDoctor: (
    data: Omit<Doctor, "id" | "createdAt">
  ) => Promise<Doctor | null>;
  updateDoctor: (id: string, data: Partial<Doctor>) => Promise<boolean>;
  removeDoctor: (id: string) => Promise<{ ok: boolean; message?: string }>;

  addPatient: (
    data: Omit<Patient, "id" | "createdAt" | "updatedAt">
  ) => Promise<Patient | null>;
  updatePatient: (id: string, data: Partial<Patient>) => Promise<boolean>;
  removePatient: (id: string) => Promise<boolean>;

  addAppointment: (data: {
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    reason: string;
  }) => Promise<Appointment | null>;
  setAppointmentStatus: (
    id: string,
    status: AppointmentStatus
  ) => Promise<boolean>;
  markReminderSent: (id: string) => Promise<boolean>;

  addConsultation: (
    data: Omit<Consultation, "id" | "createdAt" | "createdBy">
  ) => Promise<Consultation | null>;
};

const StoreContext = React.createContext<StoreValue | null>(null);

type ErroBanco = { message: string; code?: string; details?: string } | null;

/**
 * Traduz erro de banco para algo que a recepção entenda.
 *
 * Vai primeiro pelo SQLSTATE, que é estável, e só depois cai no texto. As
 * regras de negócio da migração 0006 chegam aqui como 23514 (check) ou 42501
 * (privilégio), com a mensagem já em português — nesses casos repassamos ela.
 */
function friendlyError(erro: ErroBanco | string): string {
  const message = typeof erro === "string" ? erro : (erro?.message ?? "");
  const code = typeof erro === "string" ? undefined : erro?.code;
  const texto = message.toLowerCase();

  // Índices únicos que a 0006 criou — cada um vira uma frase específica.
  if (code === "23505" || texto.includes("duplicate key")) {
    if (texto.includes("sem_choque_medico"))
      return "Esse médico já tem consulta marcada nesse dia e horário.";
    if (texto.includes("sem_choque_paciente"))
      return "Esse paciente já tem consulta marcada nesse dia e horário.";
    if (texto.includes("uma_por_agendamento"))
      return "Este agendamento já tem uma consulta registrada.";
    if (texto.includes("cnpj")) return "Já existe uma clínica com esse CNPJ.";
    if (texto.includes("email")) return "Esse e-mail já está em uso.";
    return "Esse registro já existe.";
  }

  switch (code) {
    case "23514": // check_violation — regra de negócio da 0006
      return message || "Os dados não passaram na validação.";
    case "23502": // not_null_violation
      return "Faltou preencher um campo obrigatório.";
    case "23503": // foreign_key_violation
      return "Esse registro está sendo usado por consultas ou agendamentos e não pode ser removido.";
    case "22001": // string_data_right_truncation
      return "Algum texto ficou longo demais para o campo.";
    case "22007":
    case "22008": // datetime inválido
      return "Data ou horário inválido.";
    case "42501": // insufficient_privilege — RLS ou gatilho de permissão
      return message || "Esta ação é restrita a contas administradoras.";
    case "57014": // query_canceled
      return "A consulta demorou demais e foi interrompida. Tente de novo.";
    case "PGRST301":
      return "Sua sessão expirou. Entre de novo.";
  }

  if (texto.includes("schema cache") || texto.includes("does not exist")) {
    return "O banco ainda está no formato antigo. Rode as migrações pendentes de supabase/migrations/ no SQL Editor do Supabase.";
  }
  if (texto.includes("row-level security") || texto.includes("violates row-level")) {
    return "Esta ação é restrita a contas administradoras.";
  }
  if (texto.includes("failed to fetch") || texto.includes("networkerror")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  return message || "Não foi possível concluir a operação.";
}

/** Erro que não veio do Postgres — queda de rede, principalmente. */
function erroInesperado(e: unknown): string {
  if (e instanceof Error) {
    if (/fetch|network|load failed/i.test(e.message)) {
      return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    }
    return e.message;
  }
  return "Falha inesperada. Tente de novo.";
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [clinic, setClinic] = React.useState<Clinic | null>(null);
  const [member, setMember] = React.useState<Member | null>(null);
  const [isPlatformOwner, setIsPlatformOwner] = React.useState(false);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [doctors, setDoctors] = React.useState<Doctor[]>([]);
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setClinic(null);
      setMember(null);
      setIsPlatformOwner(false);
      setMembers([]);
      setInvites([]);
      setDoctors([]);
      setPatients([]);
      setAppointments([]);
      setConsultations([]);
      setLoading(false);
      return;
    }

    // Dono da plataforma: quem cadastra as clínicas. Pode não pertencer a
    // nenhuma delas, então a checagem é independente do vínculo.
    const owner = await supabase.rpc("is_platform_owner");
    setIsPlatformOwner(owner.data === true);

    // O vínculo conta ↔ clínica define tudo: sem ele não há o que carregar.
    const membership = await supabase
      .from("clinic_members")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membership.error) {
      setError(friendlyError(membership.error));
      setLoading(false);
      return;
    }

    const memberRow = membership.data;

    // Sem vínculo não há dados: ou a conta foi criada com um e-mail diferente
    // do convite, ou é o dono da plataforma, que não pertence a clínica alguma.
    if (!memberRow) {
      setClinic(null);
      setMember(null);
      setMembers([]);
      setInvites([]);
      setDoctors([]);
      setPatients([]);
      setAppointments([]);
      setConsultations([]);
      setLoading(false);
      return;
    }

    const [profile, team, pending, docs, pats, apts, cons] = await Promise.all([
      supabase
        .from("clinics")
        .select("*")
        .eq("id", memberRow.clinic_id)
        .maybeSingle(),
      // O filtro por clinic_id é explícito porque o dono da plataforma
      // enxerga contas de todas as clínicas — aqui queremos só esta.
      supabase
        .from("clinic_members")
        .select("*")
        .eq("clinic_id", memberRow.clinic_id)
        .order("name"),
      // Só admin enxerga convites; para os demais volta vazio, sem erro.
      supabase
        .from("clinic_invites")
        .select("*")
        .eq("clinic_id", memberRow.clinic_id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("doctors").select("*").order("name"),
      supabase.from("patients").select("*").order("name"),
      supabase
        .from("appointments")
        .select("*")
        .order("scheduled_date")
        .order("scheduled_time"),
      supabase
        .from("consultations")
        .select("*")
        .order("occurred_on", { ascending: false }),
    ]);

    const failure =
      profile.error ??
      team.error ??
      docs.error ??
      pats.error ??
      apts.error ??
      cons.error ??
      null;
    if (failure) {
      setError(friendlyError(failure));
      setLoading(false);
      return;
    }

    if (!profile.data) {
      setError("Clínica não encontrada para esta conta.");
      setLoading(false);
      return;
    }

    setClinic(toClinic(profile.data));
    setMember(toMember(memberRow));
    setMembers((team.data ?? []).map(toMember));
    setInvites((pending.data ?? []).map(toInvite));
    setDoctors((docs.data ?? []).map(toDoctor));
    setPatients((pats.data ?? []).map(toPatient));
    setAppointments((apts.data ?? []).map(toAppointment));
    setConsultations((cons.data ?? []).map(toConsultation));
    } catch (e) {
      // Queda de rede, DNS, servidor fora: nada disso vira PostgrestError.
      setError(erroInesperado(e));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load, supabase]);

  const value = React.useMemo<StoreValue>(() => {
    const byName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, "pt-BR");

    return {
      loading,
      error,
      clinic,
      member,
      isAdmin: member?.role === "admin",
      isPlatformOwner,
      members,
      invites,
      doctors,
      patients,
      appointments,
      consultations,

      refresh: load,

      async signOut() {
        await supabase.auth.signOut();
        setClinic(null);
        setMember(null);
        setIsPlatformOwner(false);
        setMembers([]);
        setInvites([]);
        setDoctors([]);
        setPatients([]);
        setAppointments([]);
        setConsultations([]);
      },

      // -------------------------------------------------------------- equipe

      async inviteMember(email, role) {
        if (!clinic) return { ok: false, message: "Clínica não carregada." };
        const { data: row, error: err } = await supabase
          .from("clinic_invites")
          .insert({ clinic_id: clinic.id, email: email.trim(), role })
          .select("*")
          .single();
        if (err || !row) {
          return {
            ok: false,
            message: friendlyError(err ?? "Não foi possível convidar."),
          };
        }
        setInvites((prev) => [toInvite(row), ...prev]);
        return { ok: true };
      },

      async revokeInvite(id) {
        const { error: err } = await supabase
          .from("clinic_invites")
          .delete()
          .eq("id", id);
        if (err) {
          setError(friendlyError(err));
          return false;
        }
        setInvites((prev) => prev.filter((i) => i.id !== id));
        return true;
      },

      async setMemberRole(userId, role) {
        const { data: row, error: err } = await supabase
          .from("clinic_members")
          .update({ role })
          .eq("user_id", userId)
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível atualizar."));
          return false;
        }
        const updated = toMember(row);
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? updated : m))
        );
        return true;
      },

      async removeMember(userId) {
        const { error: err } = await supabase
          .from("clinic_members")
          .delete()
          .eq("user_id", userId);
        if (err) {
          return { ok: false, message: friendlyError(err) };
        }
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        return { ok: true };
      },

      getDoctor: (id) => doctors.find((d) => d.id === id),

      doctorName: (id) =>
        doctors.find((d) => d.id === id)?.name ?? "Médico removido",

      memberName: (userId) =>
        userId
          ? (members.find((m) => m.userId === userId)?.name ?? null)
          : null,

      getPatient: (id) => patients.find((p) => p.id === id),

      appointmentsOf: (patientId) =>
        appointments
          .filter((a) => a.patientId === patientId)
          .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),

      consultationsOf: (patientId) =>
        consultations
          .filter((c) => c.patientId === patientId)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),

      missedOf: (patientId) =>
        appointments
          .filter((a) => a.patientId === patientId && a.status === "faltou")
          .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)),

      todayAppointments: () => {
        const iso = today();
        return appointments
          .filter((a) => a.date === iso && a.status !== "cancelada")
          .sort((a, b) => a.time.localeCompare(b.time));
      },

      // ------------------------------------------------------------ médicos

      async addDoctor(data) {
        if (!clinic) return null;
        const { data: row, error: err } = await supabase
          .from("doctors")
          .insert({
            clinic_id: clinic.id,
            name: data.name,
            crm: data.crm,
            specialty: data.specialty,
          })
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível salvar."));
          return null;
        }
        const doctor = toDoctor(row);
        setDoctors((prev) => [...prev, doctor].sort(byName));
        return doctor;
      },

      async updateDoctor(id, data) {
        const { data: row, error: err } = await supabase
          .from("doctors")
          .update({
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.crm !== undefined ? { crm: data.crm } : {}),
            ...(data.specialty !== undefined
              ? { specialty: data.specialty }
              : {}),
          })
          .eq("id", id)
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível salvar."));
          return false;
        }
        const doctor = toDoctor(row);
        setDoctors((prev) =>
          prev.map((d) => (d.id === id ? doctor : d)).sort(byName)
        );
        return true;
      },

      async removeDoctor(id) {
        const { error: err } = await supabase
          .from("doctors")
          .delete()
          .eq("id", id);
        if (err) {
          return { ok: false, message: friendlyError(err) };
        }
        setDoctors((prev) => prev.filter((d) => d.id !== id));
        return { ok: true };
      },

      // ---------------------------------------------------------- pacientes

      async addPatient(data) {
        if (!clinic) return null;
        const { data: row, error: err } = await supabase
          .from("patients")
          .insert(newPatientToRow(data, clinic.id))
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível salvar."));
          return null;
        }
        const patient = toPatient(row);
        setPatients((prev) => [...prev, patient].sort(byName));
        return patient;
      },

      async updatePatient(id, data) {
        const atual = patients.find((p) => p.id === id);
        // Edição simultânea: se updated_at mudou desde que carregamos, alguém
        // salvou antes. Melhor avisar do que sobrescrever em silêncio.
        const query = supabase
          .from("patients")
          .update(patientToRow(data))
          .eq("id", id);
        if (atual) query.eq("updated_at", atual.updatedAt);

        const { data: rows, error: err } = await query.select("*");
        if (err) {
          setError(friendlyError(err));
          return false;
        }
        if (!rows || rows.length === 0) {
          setError(
            "Outra pessoa alterou este paciente enquanto você editava. Recarregue a ficha e tente de novo."
          );
          return false;
        }
        const patient = toPatient(rows[0]);
        setPatients((prev) => prev.map((p) => (p.id === id ? patient : p)));
        return true;
      },

      /**
       * Arquiva o paciente em vez de apagar.
       *
       * Prontuário tem guarda obrigatória: o registro sai das listas, mas
       * continua no banco. Só administrador consegue — o gatilho no banco
       * recusa para os demais.
       */
      async removePatient(id) {
        const { error: err } = await supabase
          .from("patients")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (err) {
          setError(friendlyError(err));
          return false;
        }
        setPatients((prev) => prev.filter((p) => p.id !== id));
        setAppointments((prev) => prev.filter((a) => a.patientId !== id));
        setConsultations((prev) => prev.filter((c) => c.patientId !== id));
        return true;
      },

      // ------------------------------------------------------- agendamentos

      async addAppointment(data) {
        if (!clinic) return null;
        const { data: row, error: err } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinic.id,
            doctor_id: data.doctorId,
            patient_id: data.patientId,
            scheduled_date: data.date,
            scheduled_time: data.time,
            reason: data.reason,
          })
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível agendar."));
          return null;
        }
        const appointment = toAppointment(row);
        setAppointments((prev) => [...prev, appointment]);
        return appointment;
      },

      async setAppointmentStatus(id, status) {
        const { data: row, error: err } = await supabase
          .from("appointments")
          .update({ status })
          .eq("id", id)
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível atualizar."));
          return false;
        }
        const appointment = toAppointment(row);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? appointment : a))
        );
        return true;
      },

      async markReminderSent(id) {
        const { data: row, error: err } = await supabase
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", id)
          .select("*")
          .single();
        if (err || !row) return false;
        const appointment = toAppointment(row);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? appointment : a))
        );
        return true;
      },

      // ----------------------------------------------------------- consultas

      async addConsultation(data) {
        if (!clinic) return null;
        const { data: row, error: err } = await supabase
          .from("consultations")
          .insert({
            clinic_id: clinic.id,
            doctor_id: data.doctorId,
            patient_id: data.patientId,
            appointment_id: data.appointmentId,
            occurred_on: data.date,
            complaint: data.complaint,
            evolution: data.evolution,
            diagnosis: data.diagnosis,
            prescription: data.prescription,
          })
          .select("*")
          .single();
        if (err || !row) {
          setError(friendlyError(err ?? "Não foi possível salvar."));
          return null;
        }
        const consultation = toConsultation(row);
        setConsultations((prev) => [consultation, ...prev]);

        // Registrar a consulta encerra o agendamento correspondente.
        if (data.appointmentId) {
          const { data: aptRow } = await supabase
            .from("appointments")
            .update({ status: "realizada" })
            .eq("id", data.appointmentId)
            .select("*")
            .single();
          if (aptRow) {
            const appointment = toAppointment(aptRow);
            setAppointments((prev) =>
              prev.map((a) => (a.id === appointment.id ? appointment : a))
            );
          }
        }
        return consultation;
      },
    };
  }, [
    supabase,
    load,
    loading,
    error,
    clinic,
    member,
    isPlatformOwner,
    members,
    invites,
    doctors,
    patients,
    appointments,
    consultations,
  ]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}
