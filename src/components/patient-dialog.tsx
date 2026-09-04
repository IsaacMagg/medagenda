"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { onlyDigits } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Patient } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Passar para editar; omitir para criar. */
  patient?: Patient;
  onSaved?: (patient: Patient) => void;
};

const empty = {
  name: "",
  birthDate: "",
  phone: "",
  email: "",
  cpf: "",
  address: "",
  notes: "",
};

export function PatientDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: Props) {
  const { addPatient, updatePatient } = useStore();
  const [form, setForm] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setForm(
      patient
        ? {
            name: patient.name,
            birthDate: patient.birthDate,
            phone: patient.phone,
            email: patient.email ?? "",
            cpf: patient.cpf ?? "",
            address: patient.address ?? "",
            notes: patient.notes ?? "",
          }
        : empty
    );
  }, [open, patient]);

  function set<K extends keyof typeof form>(field: K) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.birthDate || !form.phone.trim()) {
      setError("Nome, data de nascimento e telefone são obrigatórios.");
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      phone: onlyDigits(form.phone),
    };

    setSaving(true);
    setError(null);

    if (patient) {
      const ok = await updatePatient(patient.id, payload);
      setSaving(false);
      if (!ok) {
        setError("Não foi possível salvar. Tente de novo.");
        return;
      }
      onSaved?.({ ...patient, ...payload });
    } else {
      const created = await addPatient(payload);
      setSaving(false);
      if (!created) {
        setError("Não foi possível cadastrar. Tente de novo.");
        return;
      }
      onSaved?.(created);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {patient ? "Editar paciente" : "Novo paciente"}
          </DialogTitle>
          <DialogDescription>
            O telefone é usado nos lembretes de WhatsApp — inclua DDD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nome completo *</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Maria da Silva"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-birth">Data de nascimento *</Label>
              <Input
                id="p-birth"
                type="date"
                value={form.birthDate}
                onChange={set("birthDate")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-phone">Telefone / WhatsApp *</Label>
              <Input
                id="p-phone"
                value={form.phone}
                onChange={set("phone")}
                placeholder="(11) 98877-6655"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-email">E-mail</Label>
              <Input
                id="p-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="maria@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cpf">CPF</Label>
              <Input
                id="p-cpf"
                value={form.cpf}
                onChange={set("cpf")}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-address">Endereço</Label>
            <Input
              id="p-address"
              value={form.address}
              onChange={set("address")}
              placeholder="Rua, número — cidade/UF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-notes">Observações clínicas</Label>
            <Textarea
              id="p-notes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Alergias, comorbidades, medicações de uso contínuo…"
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
                <Save className="size-4" />
              )}
              {patient ? "Salvar alterações" : "Cadastrar paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
