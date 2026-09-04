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
import { useStore } from "@/lib/store";
import type { Doctor } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Passar para editar; omitir para criar. */
  doctor?: Doctor;
  onSaved?: (doctor: Doctor) => void;
};

const empty = { name: "", crm: "", specialty: "" };

export function DoctorDialog({ open, onOpenChange, doctor, onSaved }: Props) {
  const { addDoctor, updateDoctor } = useStore();
  const [form, setForm] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setForm(
      doctor
        ? {
            name: doctor.name,
            crm: doctor.crm,
            specialty: doctor.specialty,
          }
        : empty
    );
  }, [open, doctor]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.crm.trim()) {
      setError("Nome e registro profissional são obrigatórios.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      crm: form.crm.trim(),
      specialty: form.specialty.trim() || "Clínica Geral",
    };

    setSaving(true);
    setError(null);

    if (doctor) {
      const ok = await updateDoctor(doctor.id, payload);
      setSaving(false);
      if (!ok) {
        setError("Não foi possível salvar. Tente de novo.");
        return;
      }
      onSaved?.({ ...doctor, ...payload });
    } else {
      const created = await addDoctor(payload);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{doctor ? "Editar médico" : "Novo médico"}</DialogTitle>
          <DialogDescription>
            Os médicos cadastrados aqui aparecem na hora de marcar a consulta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-name">Nome completo *</Label>
            <Input
              id="d-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Helena Prado"
            />
          </div>

          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-crm">Registro profissional *</Label>
                <Input
                  id="d-crm"
                  value={form.crm}
                  onChange={set("crm")}
                  placeholder="CRM, CRO, CRP…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-specialty">Especialidade</Label>
                <Input
                  id="d-specialty"
                  value={form.specialty}
                  onChange={set("specialty")}
                  placeholder="Clínica Geral"
                />
              </div>
            </div>
            {/* Cada especialidade tem seu conselho — o campo aceita qualquer um. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Aceita o registro de qualquer conselho: CRM, CRO, CRP, CREFITO,
              CRN e outros.
            </p>
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
              {doctor ? "Salvar alterações" : "Cadastrar médico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
