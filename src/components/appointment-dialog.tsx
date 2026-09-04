"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { today } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Appointment } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trava o paciente (usado na ficha do paciente). */
  patientId?: string;
  /** Pré-seleciona a data (usado ao clicar num dia da agenda). */
  defaultDate?: string;
  /** Pré-seleciona o médico (usado ao filtrar a agenda por médico). */
  defaultDoctorId?: string;
  onSaved?: (appointment: Appointment) => void;
};

export function AppointmentDialog({
  open,
  onOpenChange,
  patientId,
  defaultDate,
  defaultDoctorId,
  onSaved,
}: Props) {
  const { patients, doctors, addAppointment } = useStore();
  const [form, setForm] = React.useState({
    patientId: patientId ?? "",
    doctorId: defaultDoctorId ?? "",
    date: defaultDate ?? today(),
    time: "09:00",
    reason: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setForm({
      patientId: patientId ?? "",
      // Com um médico só na clínica, já vem escolhido.
      doctorId: defaultDoctorId ?? (doctors.length === 1 ? doctors[0].id : ""),
      date: defaultDate ?? today(),
      time: "09:00",
      reason: "",
    });
  }, [open, patientId, defaultDate, defaultDoctorId, doctors]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.patientId) {
      setError("Escolha o paciente.");
      return;
    }
    if (!form.doctorId) {
      setError("Escolha o médico que vai atender.");
      return;
    }
    if (!form.date || !form.time) {
      setError("Informe data e horário.");
      return;
    }

    setSaving(true);
    setError(null);

    const appointment = await addAppointment({
      patientId: form.patientId,
      doctorId: form.doctorId,
      date: form.date,
      time: form.time,
      reason: form.reason.trim(),
    });

    setSaving(false);
    if (!appointment) {
      setError("Não foi possível agendar. Tente de novo.");
      return;
    }
    onSaved?.(appointment);
    onOpenChange(false);
  }

  const sortedPatients = [...patients].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  // Sem médico cadastrado não há como agendar.
  const semMedicos = doctors.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar consulta</DialogTitle>
          <DialogDescription>
            A consulta entra como “aguardando confirmação” até o paciente
            responder pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {semMedicos ? (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary-soft/40 p-5 text-center">
            <p className="font-medium">Nenhum médico cadastrado</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Toda consulta precisa de um médico responsável. Cadastre pelo menos
              um antes de marcar.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/medicos">Cadastrar médico</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {patientId ? null : (
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Select
                  value={form.patientId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, patientId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedPatients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Médico *</Label>
              <Select
                value={form.doctorId}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, doctorId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Quem vai atender" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} · {d.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-date">Data *</Label>
                <Input
                  id="a-date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-time">Horário *</Label>
                <Input
                  id="a-time"
                  type="time"
                  value={form.time}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, time: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-reason">Motivo da consulta</Label>
              <Input
                id="a-reason"
                value={form.reason}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Retorno, primeira consulta, revisão de exames…"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Agendar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
