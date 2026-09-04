"use client";

import * as React from "react";
import { Check, ExternalLink, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatPhone } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Appointment } from "@/lib/types";
import {
  buildConfirmationMessage,
  buildWhatsAppLink,
} from "@/lib/whatsapp";

type Props = {
  appointment: Appointment;
  size?: "sm" | "default";
  variant?: "whatsapp" | "outline";
  label?: string;
};

/**
 * Botão de confirmação por WhatsApp.
 * Abre um preview da mensagem antes de disparar — assim o médico revisa o texto
 * e o número antes de mandar. O envio em si é o wa.me (esqueleto da integração).
 */
export function WhatsAppConfirmButton({
  appointment,
  size = "sm",
  variant = "whatsapp",
  label = "Confirmar por WhatsApp",
}: Props) {
  const { getPatient, getDoctor, clinic, markReminderSent } = useStore();
  const patient = getPatient(appointment.patientId);
  const doctor = getDoctor(appointment.doctorId);
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");

  if (!patient) return null;

  function openDialog() {
    setMessage(
      buildConfirmationMessage(patient!, appointment, doctor, clinic)
    );
    setOpen(true);
  }

  function send() {
    window.open(
      buildWhatsAppLink(patient!.phone, message),
      "_blank",
      "noopener"
    );
    void markReminderSent(appointment.id);
    setOpen(false);
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={openDialog}>
        <MessageCircle className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir confirmação por WhatsApp</DialogTitle>
            <DialogDescription>
              A mensagem será aberta no WhatsApp já endereçada ao número salvo no
              cadastro do paciente.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Paciente</span>
              <span className="font-medium">{patient.name}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-4">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium">{formatPhone(patient.phone)}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-4">
              <span className="text-muted-foreground">Consulta</span>
              <span className="font-medium">
                {formatDate(appointment.date)} às {appointment.time}
              </span>
            </div>
            <div className="mt-1.5 flex justify-between gap-4">
              <span className="text-muted-foreground">Médico</span>
              <span className="font-medium">
                {doctor?.name ?? "não definido"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mensagem</label>
            <Textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            {appointment.reminderSentAt ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5" />
                Último envio em{" "}
                {new Date(appointment.reminderSentAt).toLocaleString("pt-BR")}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="whatsapp" onClick={send}>
              <ExternalLink className="size-4" />
              Abrir WhatsApp e enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
