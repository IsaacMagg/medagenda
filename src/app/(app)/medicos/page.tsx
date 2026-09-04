"use client";

import * as React from "react";
import { Lock, Pencil, Stethoscope, Trash2, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DoctorDialog } from "@/components/doctor-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials, today } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Doctor } from "@/lib/types";

export default function MedicosPage() {
  const { doctors, appointments, consultations, removeDoctor, isAdmin } =
    useStore();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Doctor | undefined>();
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const t = today();

  function openNew() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(doctor: Doctor) {
    setEditing(doctor);
    setDialogOpen(true);
  }

  async function handleRemove(doctor: Doctor) {
    setRemoveError(null);
    const result = await removeDoctor(doctor.id);
    if (!result.ok) {
      setRemoveError(
        `${doctor.name} não pode ser removido: ${result.message ?? "há registros vinculados."}`
      );
    }
  }

  return (
    <>
      <PageHeader
        icon={Stethoscope}
        title="Médicos"
        description="Quem atende nesta clínica. É desta lista que a recepção escolhe na hora de agendar."
        action={
          isAdmin ? (
            <Button onClick={openNew}>
              <UserPlus className="size-4" />
              Novo médico
            </Button>
          ) : null
        }
      />

      {!isAdmin ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-border bg-muted/50 p-4">
          <Lock className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Somente leitura</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cadastrar, editar e excluir médicos é restrito a contas
              administradoras. Você pode consultar a lista e usá-la ao agendar.
            </p>
          </div>
        </div>
      ) : null}

      {removeError ? (
        <p
          className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive"
          role="alert"
        >
          {removeError}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {doctors.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
                <Stethoscope className="size-6" />
              </span>
              <p className="font-medium">Nenhum médico cadastrado</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                {isAdmin
                  ? "Cadastre pelo menos um médico antes de marcar consultas — todo agendamento precisa saber quem vai atender."
                  : "Peça a uma conta administradora que cadastre os médicos: sem eles não é possível agendar."}
              </p>
              {isAdmin ? (
                <Button className="mt-5" onClick={openNew}>
                  <UserPlus className="size-4" />
                  Cadastrar o primeiro médico
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Médico</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Agenda</TableHead>
                  <TableHead>Consultas</TableHead>
                  {isAdmin ? (
                    <TableHead className="text-right">Ações</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor) => {
                  const upcoming = appointments.filter(
                    (a) =>
                      a.doctorId === doctor.id &&
                      a.date >= t &&
                      a.status !== "cancelada"
                  ).length;
                  const done = consultations.filter(
                    (c) => c.doctorId === doctor.id
                  ).length;

                  return (
                    <TableRow key={doctor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary">
                            {initials(doctor.name)}
                          </span>
                          <span className="font-medium">{doctor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doctor.crm}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {doctor.specialty}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {upcoming > 0 ? (
                          <span className="text-primary">
                            {upcoming} agendada{upcoming === 1 ? "" : "s"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {done} registrada{done === 1 ? "" : "s"}
                      </TableCell>
                      {isAdmin ? (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(doctor)}
                            >
                              <Pencil className="size-4" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(doctor)}
                              aria-label={`Remover ${doctor.name}`}
                              title="Remover"
                            >
                              <Trash2 className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DoctorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        doctor={editing}
      />
    </>
  );
}
