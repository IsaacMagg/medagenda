import type { AppointmentStatus } from "./types";

/**
 * A clínica opera no horário de Brasília, não no fuso do computador da
 * recepção. Tudo que envolve "hoje" passa por aqui.
 */
export const FUSO_CLINICA = "America/Sao_Paulo";

/** YYYY-MM-DD do dia local (sem cair no fuso do toISOString). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** O dia de hoje em Brasília — o "en-CA" já entrega no formato YYYY-MM-DD. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_CLINICA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Hora atual de Brasília, HH:mm:ss. */
export function horaBrasilia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

/** Data por extenso curta em Brasília — ex.: "qui, 04 set". */
export function dataCurtaBrasilia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_CLINICA,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseISODate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Converte YYYY-MM-DD em Date local (evita o parse UTC do construtor). */
export function parseISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(isoDate: string): string {
  return parseISODate(isoDate).toLocaleDateString("pt-BR");
}

export function formatDateLong(isoDate: string): string {
  return parseISODate(isoDate).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function relativeDayLabel(isoDate: string): string {
  const diff = daysBetween(today(), isoDate);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return formatDate(isoDate);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISO).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function calcAge(birthDate: string): number {
  const b = parseISODate(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(age, 0);
}

/** 5511999998888 -> (11) 99999-8888 */
export function formatPhone(raw: string): string {
  const digits = onlyDigits(raw);
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11)
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** 12345678000199 -> 12.345.678/0001-99 */
export function formatCNPJ(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Confere os dois dígitos verificadores do CNPJ. */
export function isValidCNPJ(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // 00000000000000 e afins

  const digit = (slice: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(slice[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = digit(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(d[12])) return false;

  const second = digit(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(d[13]);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export const statusLabel: Record<AppointmentStatus, string> = {
  agendada: "Aguardando confirmação",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  faltou: "Faltou",
};

/**
 * Cancelar e faltar não são a mesma coisa: cancelar com antecedência devolve o
 * horário para a agenda, faltar não devolve nada. Por isso o vermelho fica com
 * a falta, e o cancelamento vira neutro.
 */
export const statusVariant: Record<
  AppointmentStatus,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  agendada: "warning",
  confirmada: "success",
  realizada: "secondary",
  cancelada: "secondary",
  faltou: "destructive",
};
