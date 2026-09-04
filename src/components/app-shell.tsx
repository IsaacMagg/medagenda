"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Stethoscope,
  UserRoundX,
  Users,
  X,
} from "lucide-react";

import { BrandMark, CrossPattern } from "@/components/decorations";
import { RelogioBrasilia } from "@/components/relogio-brasilia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useStore } from "@/lib/store";

/** Telas da clínica — só aparecem para quem pertence a uma. */
const navClinica = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/medicos", label: "Médicos", icon: Stethoscope },
  { href: "/equipe", label: "Equipe", icon: ShieldCheck },
];

export function AppShell({
  children,
  /**
   * A tela exige pertencer a uma clínica? A área de Administração passa
   * `false`: o dono da plataforma pode não ter clínica nenhuma.
   */
  requireClinic = true,
}: {
  children: React.ReactNode;
  requireClinic?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { clinic, member, isPlatformOwner, loading, error, signOut } =
    useStore();

  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // O dono da plataforma sem clínica não tem o que ver nas telas de
  // atendimento: mandamos para a Administração.
  React.useEffect(() => {
    if (requireClinic && !loading && !clinic && isPlatformOwner) {
      router.replace("/administracao");
    }
  }, [requireClinic, loading, clinic, isPlatformOwner, router]);

  // O middleware já barra quem não está autenticado; aqui só esperamos o
  // cadastro da clínica chegar do Supabase.
  if (loading || (requireClinic && isPlatformOwner && !clinic)) {
    return (
      <div className="grid min-h-screen place-items-center bg-clinic">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-11 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  // Conta autenticada que não pertence a nenhuma clínica: quase sempre é
  // alguém que se cadastrou com um e-mail diferente do que foi convidado.
  if (requireClinic && !clinic && !error) {
    return (
      <div className="grid min-h-screen place-items-center bg-clinic px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <UserRoundX className="size-6" />
          </span>
          <p className="font-display text-lg font-semibold">
            Conta sem clínica
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Esta conta não está vinculada a nenhuma clínica. O acesso só é
            liberado por convite — confira com a clínica se o e-mail convidado é
            exatamente o mesmo que você usou aqui.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await signOut();
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar-gradient text-sidebar-foreground">
      <CrossPattern id="shell-crosses" className="text-white/[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-24 size-56 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative flex h-16 items-center gap-2.5 px-5">
        <BrandMark className="size-8" />
        <span className="font-display font-semibold tracking-tight">
          MedAgenda
        </span>
        <button
          className="ml-auto text-sidebar-muted lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="relative flex-1 px-3 py-4">
        <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
          {clinic ? "Atendimento" : "Plataforma"}
        </p>
        <div className="space-y-1">
          {[
            // As telas da clínica só fazem sentido para quem pertence a uma.
            ...(clinic ? navClinica : []),
            // E o atalho da Administração, só para o dono da plataforma.
            ...(isPlatformOwner
              ? [
                  {
                    href: "/administracao",
                    label: "Administração",
                    icon: Building2,
                  },
                ]
              : []),
          ].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    active ? "text-primary" : "text-current"
                  )}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="relative space-y-2 border-t border-white/10 p-3">
        <RelogioBrasilia />

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/25 font-display text-xs font-semibold text-sidebar-foreground">
            {clinic ? (
              initials(clinic.name)
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {clinic?.name ?? "Administração"}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {clinic
                ? member?.role === "admin"
                  ? "Administrador"
                  : "Recepção"
                : "Dono da plataforma"}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/login");
              router.refresh();
            }}
            className="text-sidebar-muted transition-colors hover:text-destructive"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-clinic lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <BrandMark className="size-7" />
          <span className="font-display font-semibold tracking-tight">
            MedAgenda
          </span>
          <RelogioBrasilia className="ml-auto border-border bg-muted/60 py-1.5 [&_p:last-child]:text-muted-foreground" />
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {error ? (
            <div className="mb-6 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Não consegui falar com o banco
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {Icon ? (
          <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div>
          <h1 className="font-display text-[1.7rem] font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
