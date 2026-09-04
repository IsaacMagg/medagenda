"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronRight,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { PatientDialog } from "@/components/patient-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcAge,
  formatDate,
  formatPhone,
  initials,
  onlyDigits,
} from "@/lib/format";
import { useStore } from "@/lib/store";

export default function PacientesPage() {
  const { patients, appointments, consultations } = useStore();
  const [query, setQuery] = React.useState("");
  const [patientOpen, setPatientOpen] = React.useState(false);
  const [scheduleFor, setScheduleFor] = React.useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const digits = onlyDigits(query);

  const filtered = patients
    .filter((p) => {
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (digits.length >= 3 && p.phone.includes(digits)) ||
        (p.email ?? "").toLowerCase().includes(term)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function lastConsultation(patientId: string) {
    return consultations
      .filter((c) => c.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  return (
    <>
      <PageHeader
        icon={Users}
        title="Pacientes"
        description="Cada paciente tem sua ficha e o histórico completo de consultas."
        action={
          <Button onClick={() => setPatientOpen(true)}>
            <UserPlus className="size-4" />
            Novo paciente
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {patients.length === 0
                  ? "Nenhum paciente cadastrado ainda."
                  : "Nenhum paciente encontrado para essa busca."}
              </p>
              {patients.length === 0 ? (
                <Button className="mt-4" onClick={() => setPatientOpen(true)}>
                  <UserPlus className="size-4" />
                  Cadastrar o primeiro paciente
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Idade</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Consultas</TableHead>
                  <TableHead>Faltas</TableHead>
                  <TableHead>Última consulta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((patient) => {
                  const last = lastConsultation(patient.id);
                  const total = consultations.filter(
                    (c) => c.patientId === patient.id
                  ).length;
                  const scheduled = appointments.filter(
                    (a) =>
                      a.patientId === patient.id &&
                      (a.status === "agendada" || a.status === "confirmada")
                  ).length;
                  const missed = appointments
                    .filter(
                      (a) =>
                        a.patientId === patient.id && a.status === "faltou"
                    )
                    .sort((a, b) => b.date.localeCompare(a.date));

                  return (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary">
                            {initials(patient.name)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/pacientes/${patient.id}`}
                              className="font-medium hover:underline"
                            >
                              {patient.name}
                            </Link>
                            {patient.email ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {patient.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {calcAge(patient.birthDate)} anos
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatPhone(patient.phone)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {total} registrada{total === 1 ? "" : "s"}
                        {scheduled > 0 ? (
                          <span className="block text-xs text-primary">
                            {scheduled} agendada{scheduled === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {missed.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className="font-medium text-destructive"
                            title={`Faltou em: ${missed
                              .map((a) => formatDate(a.date))
                              .join(", ")}`}
                          >
                            {missed.length} falta
                            {missed.length === 1 ? "" : "s"}
                            <span className="block text-xs font-normal text-muted-foreground">
                              última em {formatDate(missed[0].date)}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {last ? formatDate(last.date) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setScheduleFor(patient.id)}
                          >
                            <CalendarPlus className="size-4" />
                            Agendar
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              href={`/pacientes/${patient.id}`}
                              aria-label={`Abrir ficha de ${patient.name}`}
                            >
                              <ChevronRight className="size-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PatientDialog open={patientOpen} onOpenChange={setPatientOpen} />
      <AppointmentDialog
        open={scheduleFor !== null}
        onOpenChange={(open) => !open && setScheduleFor(null)}
        patientId={scheduleFor ?? undefined}
      />
    </>
  );
}
