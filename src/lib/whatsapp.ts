import { formatDate, onlyDigits } from "./format";
import type { Appointment, Clinic, Doctor, Patient } from "./types";

/**
 * Esqueleto da integração de WhatsApp.
 *
 * Hoje o botão apenas abre o wa.me com a mensagem pré-preenchida e o número
 * que já está salvo no cadastro do paciente — a recepção só aperta "enviar".
 * Depois isso pode ser trocado por um POST para a Cloud API da Meta
 * (ou Twilio / Z-API) sem mexer na interface: basta reimplementar
 * `sendConfirmationRequest` mantendo a mesma assinatura.
 */

export function buildConfirmationMessage(
  patient: Patient,
  appointment: Appointment,
  doctor: Doctor | undefined,
  clinic: Clinic | null
): string {
  const primeiroNome = patient.name.split(" ")[0];
  const origem = clinic?.name ? `da ${clinic.name}` : "do consultório";
  const comMedico = doctor ? ` com ${tratamento(doctor)}` : "";

  const corpo = [
    `Você tem uma consulta marcada para ${formatDate(appointment.date)} às ${appointment.time}${comMedico}.`,
    appointment.reason ? `Motivo: ${appointment.reason}.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Olá, ${primeiroNome}! Aqui é ${origem}.`,
    corpo,
    `Você confirma sua presença? Responda SIM para confirmar ou NÃO caso precise remarcar.`,
  ].join("\n\n");
}

/** Evita "Dr. Dr. Fulano" quando o nome já vem com o tratamento. */
function tratamento(doctor: Doctor): string {
  return /^\s*(dr|dra)\.?\s/i.test(doctor.name)
    ? doctor.name
    : `Dr(a). ${doctor.name}`;
}

/** Normaliza para o formato aceito pelo wa.me (DDI + DDD + número). */
export function toWhatsAppNumber(phone: string): string {
  const digits = onlyDigits(phone);
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * Ponto único de envio. Por enquanto abre o wa.me em outra aba.
 * TODO(integração): trocar por chamada à API oficial e persistir o retorno.
 */
export function sendConfirmationRequest(
  patient: Patient,
  appointment: Appointment,
  doctor: Doctor | undefined,
  clinic: Clinic | null
): void {
  const message = buildConfirmationMessage(patient, appointment, doctor, clinic);
  window.open(buildWhatsAppLink(patient.phone, message), "_blank", "noopener");
}
