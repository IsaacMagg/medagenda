"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  UserX,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConsultationDialog } from "@/components/consultation-dialog";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppConfirmButton } from "@/components/whatsapp-confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcAge,
  formatDateLong,
  formatPhone,
  parseISODate,
  toISODate,
  today,
} from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AgendaPage() {
  const {
    appointments: allAppointments,
    doctors,
    getPatient,
    doctorName,
    setAppointmentStatus,
  } = useStore();

  const t = today();
  const [selected, setSelected] = React.useState(t);
  /** "todos" ou o id de um médico — a recepção costuma olhar um por vez. */
  const [doctorFilter, setDoctorFilter] = React.useState("todos");

  const appointments = React.useMemo(
    () =>
      doctorFilter === "todos"
        ? allAppointments
        : allAppointments.filter((a) => a.doctorId === doctorFilter),
    [allAppointments, doctorFilter]
  );
  const [cursor, setCursor] = React.useState(() => {
    const d = parseISODate(t);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [consultationFor, setConsultationFor] = React.useState<{
    patientId: string;
    appointmentId: string;
    doctorId: string;
    date: string;
    complaint: string;
  } | null>(null);

  const byDate = React.useMemo(() => {
    const map = new Map<string, typeof appointments>();
    for (const appointment of appointments) {
      const list = map.get(appointment.date) ?? [];
      list.push(appointment);
      map.set(appointment.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [appointments]);

  const firstDay = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leading = firstDay.getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(cursor.year, cursor.month, i + 1))
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstDay.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const dayAppointments = (byDate.get(selected) ?? []).filter(
    (a) => a.status !== "cancelada"
  );
  const cancelledOfDay = (byDate.get(selected) ?? []).filter(
    (a) => a.status === "cancelada"
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const d = parseISODate(t);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(t);
  }

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="Agenda"
        description="Clique em um dia para ver as consultas e disparar as confirmações."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {doctors.length > 1 ? (
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os médicos</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button onClick={() => setScheduleOpen(true)}>
              <CalendarPlus className="size-4" />
              Novo agendamento
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base first-letter:uppercase">{monthLabel}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goToday}>
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftMonth(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => shiftMonth(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {weekDays.map((day) => (
                <div key={day} className="py-1.5">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((iso, index) => {
                if (!iso)
                  return <div key={`empty-${index}`} className="aspect-square" />;

                const items = (byDate.get(iso) ?? []).filter(
                  (a) => a.status !== "cancelada"
                );
                const isToday = iso === t;
                const isSelected = iso === selected;

                return (
                  <button
                    key={iso}
                    onClick={() => setSelected(iso)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-start gap-1 rounded-lg border border-transparent p-1.5 text-sm transition-colors",
                      "hover:border-border hover:bg-muted",
                      isToday && "border-primary/40 font-semibold text-primary",
                      isSelected &&
                        "border-primary bg-primary/10 text-foreground hover:bg-primary/10"
                    )}
                  >
                    <span>{Number(iso.slice(8))}</span>
                    {items.length > 0 ? (
                      <span className="flex flex-wrap justify-center gap-0.5">
                        {items.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            className={cn(
                              "size-1.5 rounded-full",
                              a.status === "confirmada"
                                ? "bg-[var(--success)]"
                                : a.status === "realizada"
                                  ? "bg-muted-foreground"
                                  : a.status === "faltou"
                                    ? "bg-destructive"
                                    : "bg-[var(--warning)]"
                            )}
                          />
                        ))}
                        {items.length > 3 ? (
                          <span className="text-[10px] leading-none text-muted-foreground">
                            +{items.length - 3}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--warning)]" />
                Aguardando confirmação
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--success)]" />
                Confirmada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                Realizada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-destructive" />
                Faltou
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base first-letter:uppercase">
              {formatDateLong(selected)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {dayAppointments.length === 0
                ? "Nenhuma consulta neste dia."
                : `${dayAppointments.length} consulta${dayAppointments.length > 1 ? "s" : ""} marcada${dayAppointments.length > 1 ? "s" : ""}.`}
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {dayAppointments.length === 0 ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarPlus className="size-4" />
                Agendar neste dia
              </Button>
            ) : (
              dayAppointments.map((appointment) => {
                const patient = getPatient(appointment.patientId);
                if (!patient) return null;
                return (
                  <div
                    key={appointment.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {appointment.time}
                        </p>
                        <Link
                          href={`/pacientes/${patient.id}`}
                          className="font-medium hover:underline"
                        >
                          {patient.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {calcAge(patient.birthDate)} anos ·{" "}
                          {formatPhone(patient.phone)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-primary">
                          {doctorName(appointment.doctorId)}
                        </p>
                        {appointment.reason ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {appointment.reason}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={appointment.status} />
                    </div>

                    {appointment.status !== "realizada" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
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
                            Confirmar
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
                              date: appointment.date,
                              complaint: appointment.reason,
                            })
                          }
                        >
                          <ClipboardPlus className="size-4" />
                          Nova consulta
                        </Button>
                        {/* Falta só faz sentido a partir do dia da consulta. */}
                        {appointment.date <= t &&
                        appointment.status !== "faltou" ? (
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setAppointmentStatus(appointment.id, "cancelada")
                          }
                        >
                          <X className="size-4" />
                          Cancelar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {cancelledOfDay.length > 0 ? (
              <p className="pt-1 text-xs text-muted-foreground">
                {cancelledOfDay.length} consulta
                {cancelledOfDay.length > 1 ? "s canceladas" : " cancelada"} neste
                dia.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultDate={selected}
        defaultDoctorId={doctorFilter === "todos" ? undefined : doctorFilter}
      />
      {consultationFor ? (
        <ConsultationDialog
          open
          onOpenChange={(open) => !open && setConsultationFor(null)}
          patientId={consultationFor.patientId}
          appointmentId={consultationFor.appointmentId}
          doctorId={consultationFor.doctorId}
          defaultDate={consultationFor.date}
          defaultComplaint={consultationFor.complaint}
        />
      ) : null}
    </>
  );
}
