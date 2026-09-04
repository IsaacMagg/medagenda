import { CalendarCheck, MessageCircle, Stethoscope } from "lucide-react";

import { BrandMark, CrossPattern, PulseLine } from "@/components/decorations";

const highlights = [
  {
    icon: Stethoscope,
    title: "Prontuário por paciente",
    text: "Cada consulta fica registrada no histórico do paciente, com queixa, evolução, diagnóstico e conduta.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda com lembrete",
    text: "No dia da consulta o sistema avisa a recepção direto no painel inicial.",
  },
  {
    icon: MessageCircle,
    title: "Confirmação por WhatsApp",
    text: "Um clique abre a conversa com o número salvo e a mensagem de confirmação pronta.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar-gradient p-12 text-sidebar-foreground lg:flex">
        <CrossPattern id="auth-crosses" className="text-white/[0.07]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 size-[26rem] rounded-full bg-primary/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 size-80 rounded-full bg-[var(--sky)]/20 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10" />
          <span className="font-display text-lg font-semibold tracking-tight">
            MedAgenda
          </span>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-sidebar-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            Acesso restrito à equipe da clínica
          </span>

          <h1 className="mt-6 font-display text-[2.1rem] font-semibold leading-[1.15]">
            A rotina do consultório
            <br />
            em um lugar só.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-muted">
            Cadastre pacientes, marque as consultas com o médico certo e registre o
            que aconteceu em cada atendimento — sem papel e sem planilha.
          </p>

          <ul className="mt-10 space-y-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary-foreground">
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-sidebar-muted">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <PulseLine className="h-10 text-primary/45" />
          <p className="mt-3 text-xs text-sidebar-muted">
            Dados de pacientes são sigilosos. Não compartilhe seu acesso.
          </p>
        </div>
      </aside>

      <main className="relative flex items-center justify-center overflow-hidden bg-clinic px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
