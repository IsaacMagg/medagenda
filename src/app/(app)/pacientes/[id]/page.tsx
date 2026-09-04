"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Cake,
  ClipboardPlus,
  Check,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserX,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConsultationDialog } from "@/components/consultation-dialog";
import { PatientDialog } from "@/components/patient-dialog";
import { StatusBadge } from "@/components/status-badge";
import { WhatsAppConfirmButton } from "@/components/whatsapp-confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calcAge,
  formatDate,
  formatPhone,
  initials,
  relativeDayLabel,
  today,
} from "@/lib/format";
import { useStore } from "@/lib/store";

export default function PacienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const patientId = params.id;

  const {
    getPatient,
    appointmentsOf,
    consultationsOf,
    doctorName,
    memberName,
    missedOf,
    setAppointmentStatus,
    removePatient,
    isAdmin,
    loading,
  } = useStore();

  const [removing, setRemoving] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [consultationOpen, setConsultationOpen] = React.useState(false);
  const [consultationFrom, setConsultationFrom] = React.useState<{
    appointmentId: string;
    doctorId: string;
    date: string;
    complaint: string;
  } | null>(null);

  const patient = getPatient(patientId);

  if (loading) return null;

  if (!patient) {
    return (
      <Card>
        <CardContent className="px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Paciente não encontrado.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/pacientes">
              <ArrowLeft className="size-4" />
              Voltar para pacientes
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const appointments = appointmentsOf(patient.id);
  const consultations = consultationsOf(patient.id);
  const missed = missedOf(patient.id);
  const t = today();
  const nextAppointment = [...appointments]
    .filter((a) => a.date >= t && a.status !== "cancelada")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  return (
    <>
      <Link
        href="/pacientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Pacientes
      </Link>

      <PageHeader
        title={patient.name}
        description={`${calcAge(patient.birthDate)} anos · ${formatPhone(patient.phone)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button variant="outline" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus className="size-4" />
              Agendar consulta
            </Button>
            <Button
              onClick={() => {
                setConsultationFrom(null);
                setConsultationOpen(true);
              }}
            >
              <ClipboardPlus className="size-4" />
              Nova consulta
            </Button>
            {/* Excluir paciente é restrito a contas administradoras. */}
            {isAdmin ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmRemove(true)}
                aria-label="Arquivar paciente"
                title="Arquivar paciente"
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            ) : null}
          </div>
        }
      />

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar {patient.name}?</DialogTitle>
            <DialogDescription>
              O paciente sai das listas e da busca. Os {appointments.length}{" "}
              agendamento(s) e as {consultations.length} consulta(s) continuam
              guardados no banco — prontuário tem prazo de guarda obrigatório e
              por isso não é apagado de verdade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                const ok = await removePatient(patient.id);
                setRemoving(false);
                if (ok) router.replace("/pacientes");
                else setConfirmRemove(false);
              }}
            >
              <Trash2 className="size-4" />
              Arquivar paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
                  {initials(patient.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Paciente desde {formatDate(patient.createdAt.slice(0, 10))}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <dl className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <dd>{formatPhone(patient.phone)}</dd>
                </div>
                <div className="flex gap-3">
                  <Cake className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <dd>
                    {formatDate(patient.birthDate)} ({calcAge(patient.birthDate)}{" "}
                    anos)
                  </dd>
                </div>
                {patient.email ? (
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <dd className="break-all">{patient.email}</dd>
                  </div>
                ) : null}
                {patient.address ? (
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <dd>{patient.address}</dd>
                  </div>
                ) : null}
              </dl>

              {patient.notes ? (
                <>
                  <Separator className="my-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Observações
                  </p>
                  <p className="mt-1.5 text-sm">{patient.notes}</p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Próxima consulta</CardTitle>
            </CardHeader>
            <CardContent>
              {nextAppointment ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">
                      {relativeDayLabel(nextAppointment.date)} às{" "}
                      {nextAppointment.time}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doctorName(nextAppointment.doctorId)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextAppointment.reason || "Consulta"}
                    </p>
                  </div>
                  <StatusBadge status={nextAppointment.status} />
                  <WhatsAppConfirmButton
                    appointment={nextAppointment}
                    label="Pedir confirmação"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma consulta agendada.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Histórico de faltas — o que a recepção olha antes de reagendar */}
          <Card className={missed.length > 0 ? "border-destructive/30" : ""}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Faltas</CardTitle>
              <span
                className={
                  missed.length > 0
                    ? "font-display text-lg font-semibold text-destructive"
                    : "font-display text-lg font-semibold text-muted-foreground"
                }
              >
                {missed.length}
              </span>
            </CardHeader>
            <CardContent>
              {missed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma falta registrada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {missed.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span className="font-medium">
                        {formatDate(appointment.date)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {appointment.time} · {doctorName(appointment.doctorId)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">
              Histórico ({consultations.length})
            </TabsTrigger>
            <TabsTrigger value="agendamentos">
              Agendamentos ({appointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="space-y-3">
            {consultations.length === 0 ? (
              <Card>
                <CardContent className="px-6 py-14 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma consulta registrada para este paciente.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setConsultationFrom(null);
                      setConsultationOpen(true);
                    }}
                  >
                    <ClipboardPlus className="size-4" />
                    Registrar consulta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="relative space-y-3 pl-7">
                {/* trilho do prontuário */}
                <span
                  aria-hidden
                  className="absolute bottom-5 left-[0.6rem] top-5 w-px bg-border"
                />
                {consultations.map((consultation) => (
                <Card key={consultation.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[1.31rem] top-[1.5rem] size-3 rounded-full border-2 border-card bg-primary"
                  />
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {formatDate(consultation.date)}
                      </CardTitle>
                      <p className="mt-1 text-sm font-medium text-primary">
                        {doctorName(consultation.doctorId)}
                      </p>
                      {memberName(consultation.createdBy) ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          registrado por {memberName(consultation.createdBy)}
                        </p>
                      ) : null}
                    </div>
                    {consultation.complaint ? (
                      <span className="text-sm text-muted-foreground">
                        {consultation.complaint}
                      </span>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Como foi a consulta">
                      {consultation.evolution}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {consultation.diagnosis ? (
                        <Field label="Hipótese diagnóstica">
                          {consultation.diagnosis}
                        </Field>
                      ) : null}
                      {consultation.prescription ? (
                        <Field label="Conduta / prescrição">
                          {consultation.prescription}
                        </Field>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agendamentos" className="space-y-3">
            {appointments.length === 0 ? (
              <Card>
                <CardContent className="px-6 py-14 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum agendamento para este paciente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              appointments.map((appointment) => (
                <Card key={appointment.id}>
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                    <div className="w-28 shrink-0">
                      <p className="font-medium">
                        {formatDate(appointment.date)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.time}
                      </p>
                    </div>
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">
                        {doctorName(appointment.doctorId)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.reason || "Consulta"}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />

                    {appointment.status === "agendada" ||
                    appointment.status === "confirmada" ? (
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
                            Confirmar
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setConsultationFrom({
                              appointmentId: appointment.id,
                              doctorId: appointment.doctorId,
                              date: appointment.date,
                              complaint: appointment.reason,
                            });
                            setConsultationOpen(true);
                          }}
                        >
                          <ClipboardPlus className="size-4" />
                          Registrar
                        </Button>
                        {appointment.date <= t ? (
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
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PatientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
      />
      <AppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        patientId={patient.id}
      />
      <ConsultationDialog
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        patientId={patient.id}
        appointmentId={consultationFrom?.appointmentId ?? null}
        doctorId={consultationFrom?.doctorId}
        defaultDate={consultationFrom?.date}
        defaultComplaint={consultationFrom?.complaint}
      />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}
