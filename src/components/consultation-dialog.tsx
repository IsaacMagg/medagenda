"use client";

import * as React from "react";
import { ClipboardPlus, Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { today } from "@/lib/format";
import { useStore } from "@/lib/store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Quando vem de um agendamento, ele é marcado como realizado ao salvar. */
  appointmentId?: string | null;
  /** Médico do agendamento; quando vem preenchido, não é preciso escolher. */
  doctorId?: string;
  defaultDate?: string;
  defaultComplaint?: string;
};

/** Registro do atendimento: é aqui que se descreve como foi a consulta. */
export function ConsultationDialog({
  open,
  onOpenChange,
  patientId,
  appointmentId = null,
  doctorId,
  defaultDate,
  defaultComplaint,
}: Props) {
  const { addConsultation, getPatient, doctors, doctorName } = useStore();
  const patient = getPatient(patientId);
  const [form, setForm] = React.useState({
    doctorId: doctorId ?? "",
    date: defaultDate ?? today(),
    complaint: "",
    evolution: "",
    diagnosis: "",
    prescription: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setForm({
      doctorId: doctorId ?? (doctors.length === 1 ? doctors[0].id : ""),
      date: defaultDate ?? today(),
      complaint: defaultComplaint ?? "",
      evolution: "",
      diagnosis: "",
      prescription: "",
    });
  }, [open, doctorId, defaultDate, defaultComplaint, doctors]);

  function set<K extends keyof typeof form>(field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.doctorId) {
      setError("Escolha o médico que atendeu.");
      return;
    }
    if (!form.evolution.trim()) {
      setError("Descreva como foi a consulta antes de salvar.");
      return;
    }

    setSaving(true);
    setError(null);

    const created = await addConsultation({
      patientId,
      doctorId: form.doctorId,
      appointmentId,
      date: form.date,
      complaint: form.complaint.trim(),
      evolution: form.evolution.trim(),
      diagnosis: form.diagnosis.trim(),
      prescription: form.prescription.trim(),
    });

    setSaving(false);
    if (!created) {
      setError("Não foi possível salvar a consulta. Tente de novo.");
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova consulta</DialogTitle>
          <DialogDescription>
            Registro do atendimento{patient ? ` de ${patient.name}` : ""}. Fica
            salvo no histórico do paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="space-y-2">
              <Label>Médico responsável *</Label>
              {doctorId ? (
                <div className="flex h-9.5 items-center rounded-lg border border-input bg-muted/50 px-3 text-sm">
                  {doctorName(doctorId)}
                </div>
              ) : (
                <Select
                  value={form.doctorId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, doctorId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Quem atendeu" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · {d.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-date">Data do atendimento</Label>
              <Input
                id="c-date"
                type="date"
                value={form.date}
                onChange={set("date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-complaint">Queixa principal</Label>
            <Input
              id="c-complaint"
              value={form.complaint}
              onChange={set("complaint")}
              placeholder="O que trouxe o paciente hoje"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-evolution">Como foi a consulta *</Label>
            <Textarea
              id="c-evolution"
              rows={6}
              value={form.evolution}
              onChange={set("evolution")}
              placeholder="Anamnese, exame físico, evolução do quadro, exames apresentados…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-diagnosis">Hipótese diagnóstica</Label>
              <Textarea
                id="c-diagnosis"
                rows={3}
                value={form.diagnosis}
                onChange={set("diagnosis")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-prescription">Conduta / prescrição</Label>
              <Textarea
                id="c-prescription"
                rows={3}
                value={form.prescription}
                onChange={set("prescription")}
              />
            </div>
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
                <ClipboardPlus className="size-4" />
              )}
              Salvar consulta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
