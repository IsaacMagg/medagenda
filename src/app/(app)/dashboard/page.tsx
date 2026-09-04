"use client";

import * as React from "react";
import Link from "next/link";
import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  ClipboardPlus,
  FileText,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";

import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConsultationDialog } from "@/components/consultation-dialog";
import { CrossPattern, PulseLine } from "@/components/decorations";
import { PatientDialog } from "@/components/patient-dialog";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppConfirmButton } from "@/components/whatsapp-confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcAge,
  daysBetween,
  formatDate,
  formatDateLong,
  formatPhone,
  relativeDayLabel,
  today,
} from "@/lib/format";
import { useStore } from "@/lib/store";

export default function DashboardPage() {
  const {
    clinic,
    patients,
    appointments,
    consultations,
    getPatient,
    getDoctor,
    doctorName,
    todayAppointments,
    setAppointmentStatus,
  } = useStore();

  const [patientOpen, setPatientOpen] = React.useState(false);
  const [appointmentOpen, setAppointmentOpen] = React.useState(false);
  const [consultationFor, setConsultationFor] = React.useState<{
    patientId: string;
    appointmentId: string;
    doctorId: string;
    complaint: string;
  } | null>(null);

  const t = today();
  const todays = todayAppointments();
  const pending = todays.filter((a) => a.status === "agendada");

  const upcoming = appointments
    .filter(
      (a) =>
        a.date > t && a.status !== "cancelada" && daysBetween(t, a.date) <= 14
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 6);

  const monthPrefix = t.slice(0, 7);
  const monthCount = appointments.filter(
    (a) => a.date.startsWith(monthPrefix) && a.status !== "cancelada"
  ).length;

  const recentConsultations = [...consultations]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const stats = [
    {
      label: "Pacientes cadastrados",
      value: patients.length,
      icon: Users,
      href: "/pacientes",
      tint: "bg-primary-soft text-primary",
    },
    {
      label: "Consultas hoje",
      value: todays.length,
      icon: CalendarClock,
      href: "/agenda",
      tint: "bg-sky-soft text-[var(--sky)]",
    },
    {
      label: "Aguardando confirmação",
      value: pending.length,
      icon: BellRing,
      href: "/agenda",
      tint:
        "bg-[color-mix(in_oklch,var(--warning)_20%,transparent)] text-[color-mix(in_oklch,var(--warning)_78%,black)]",
    },
    {
      label: "Consultas no mês",
      value: monthCount,
      icon: FileText,
      href: "/agenda",
      tint:
        "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]",
    },
  ];

  return (
    <>
      {/* Boas-vindas: cartão de marca com a linha de batimento */}
      <section className="relative mb-6 overflow-hidden rounded-2xl bg-sidebar-gradient p-6 text-sidebar-foreground sm:p-8">
        <CrossPattern id="dash-crosses" className="text-white/[0.06]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-primary/25 blur-3xl"
        />
        <PulseLine className="pointer-events-none absolute bottom-0 left-0 h-16 text-primary/25" />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-sidebar-muted backdrop-blur">
              <Building2 className="size-3.5" />
              {clinic?.cnpj ? `CNPJ ${clinic.cnpj}` : "Clínica"}
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              Olá, {clinic?.name ?? "clínica"}
            </h1>
            <p className="mt-1.5 text-sm text-sidebar-muted first-letter:uppercase">
              {formatDateLong(t)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-sidebar-foreground backdrop-blur hover:bg-white/20 hover:text-sidebar-foreground"
              onClick={() => setPatientOpen(true)}
            >
              <UserPlus className="size-4" />
              Novo paciente
            </Button>
            <Button onClick={() => setAppointmentOpen(true)}>
              <CalendarPlus className="size-4" />
              Agendar consulta
            </Button>
          </div>
        </div>
      </section>

      {/* Lembrete do dia — o aviso que o médico vê ao entrar no sistema */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-[var(--sky)] to-primary/40" />
        <CardHeader className="flex-row items-center gap-3.5 space-y-0 pt-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <BellRing className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">
              {todays.length === 0
                ? "Nenhuma consulta marcada para hoje"
                : `Você tem ${todays.length} consulta${todays.length > 1 ? "s" : ""} hoje`}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {todays.length === 0
                ? "Aproveite para revisar prontuários ou encaixar um retorno."
                : pending.length > 0
                  ? `${pending.length} ainda aguardando confirmação do paciente.`
                  : "Todas as consultas de hoje já foram confirmadas."}
            </p>
          </div>
        </CardHeader>

        {todays.length > 0 ? (
          <CardContent className="space-y-2.5">
            {todays.map((appointment) => {
              const patient = getPatient(appointment.patientId);
              if (!patient) return null;
              const doctor = getDoctor(appointment.doctorId);
              return (
                <div
                  key={appointment.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border/80 bg-muted/40 p-3 transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
                >
                  <span className="grid w-16 shrink-0 place-items-center rounded-lg bg-card py-1.5 font-display text-base font-semibold text-primary shadow-sm">
                    {appointment.time}
                  </span>

                  <div className="min-w-40 flex-1">
                    <Link
                      href={`/pacientes/${patient.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {patient.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {calcAge(patient.birthDate)} anos ·{" "}
                      {formatPhone(patient.phone)}
                      {appointment.reason ? ` · ${appointment.reason}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm">
                      <span className="text-muted-foreground">Médico: </span>
                      <span className="font-medium text-primary">
                        {doctor?.name ?? "não definido"}
                      </span>
                      {doctor?.specialty ? (
                        <>
                          <span className="text-muted-foreground">
                            {" · Especialidade: "}
                          </span>
                          <span className="font-medium text-primary">
                            {doctor.specialty}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <StatusBadge status={appointment.status} />

                  <div className="flex flex-wrap gap-2">
                    <WhatsAppConfirmButton
                      appointment={appointment}
                      label="WhatsApp"
                    />
                    {appointment.status === "agendada" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setAppointmentStatus(appointment.id, "confirmada")
                        }
                      >
                        <Check className="size-4" />
                        Marcar confirmada
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setConsultationFor({
                          patientId: patient.id,
                          appointmentId: appointment.id,
                          doctorId: appointment.doctorId,
                          complaint: appointment.reason,
                        })
                      }
                    >
                      <ClipboardPlus className="size-4" />
                      Nova consulta
                    </Button>
                    {appointment.status !== "faltou" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAppointmentStatus(appointment.id, "faltou")
                        }
                        title="O paciente não compareceu"
                      >
                        <UserX className="size-4" />
                        Faltou
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : null}
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, tint }) => (
          <Link key={label} href={href} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${tint}`}
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-semibold leading-none">
                    {value}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Próximas consultas</CardTitle>
            <Link
              href="/agenda"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver agenda
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 ? (
              <EmptyLine text="Nada agendado para os próximos dias." />
            ) : (
              upcoming.map((appointment) => {
                const patient = getPatient(appointment.patientId);
                if (!patient) return null;
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/70"
                  >
                    <div className="w-24 shrink-0">
                      <p className="text-sm font-medium">
                        {relativeDayLabel(appointment.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.time}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/pacientes/${patient.id}`}
                        className="truncate text-sm font-medium hover:text-primary hover:underline"
                      >
                        {patient.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {doctorName(appointment.doctorId)}
                        {appointment.reason ? ` · ${appointment.reason}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos registros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentConsultations.length === 0 ? (
              <EmptyLine text="Nenhuma consulta registrada ainda." />
            ) : (
              recentConsultations.map((consultation) => {
                const patient = getPatient(consultation.patientId);
                return (
                  <div
                    key={consultation.id}
                    className="rounded-xl border border-border/80 p-3.5 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/pacientes/${consultation.patientId}`}
                        className="text-sm font-medium hover:text-primary hover:underline"
                      >
                        {patient?.name ?? "Paciente removido"}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(consultation.date)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {consultation.evolution}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <PatientDialog open={patientOpen} onOpenChange={setPatientOpen} />
      <AppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
      />
      {consultationFor ? (
        <ConsultationDialog
          open
          onOpenChange={(open) => !open && setConsultationFor(null)}
          patientId={consultationFor.patientId}
          appointmentId={consultationFor.appointmentId}
          doctorId={consultationFor.doctorId}
          defaultComplaint={consultationFor.complaint}
        />
      ) : null}
    </>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>
  );
}
