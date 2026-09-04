"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { BrandMark } from "@/components/decorations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/** Mensagens do Supabase traduzidas para o que o médico precisa saber. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha inválidos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar — o link foi enviado no cadastro.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createClient(), []);

  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const notice =
    searchParams.get("cadastro") === "confirme"
      ? "Conta criada. Confirme o e-mail que enviamos e depois entre por aqui."
      : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!email || !password) {
      setError("Preencha e-mail e senha para entrar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(translateAuthError(authError.message));
      setSubmitting(false);
      return;
    }

    router.replace(searchParams.get("redirect") || "/dashboard");
    router.refresh();
  }

  return (
    <>
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <BrandMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-tight">
          MedAgenda
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Acesso da clínica. Use o e-mail cadastrado.
      </p>

      {notice ? (
        <p className="mt-6 rounded-lg border border-primary/30 bg-primary-soft/50 p-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail profissional</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@clinica.com"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link
              href="/recuperar-senha"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-0 grid h-9.5 w-10 place-items-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          {submitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Recebeu um convite da clínica?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-primary hover:underline"
        >
          Tenho um convite
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <React.Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </AuthShell>
  );
}
