"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { dataCurtaBrasilia, horaBrasilia } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Relógio da clínica.
 *
 * Mostra sempre o horário de Brasília, não o do computador de quem está
 * usando — se a recepção estiver com o relógio errado, a agenda continua
 * batendo com o que está no banco.
 *
 * Começa vazio e só preenche depois de montar: o horário do servidor e o do
 * navegador nunca coincidem no milissegundo, e isso quebraria a hidratação.
 */
export function RelogioBrasilia({ className }: { className?: string }) {
  const [agora, setAgora] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2",
        className
      )}
      title="Horário de Brasília"
    >
      <Clock className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-sm font-semibold tabular-nums">
          {agora ? horaBrasilia(agora) : "--:--:--"}
        </p>
        <p className="truncate text-[0.68rem] text-sidebar-muted">
          {agora ? dataCurtaBrasilia(agora) : "—"} · Brasília
        </p>
      </div>
    </div>
  );
}
