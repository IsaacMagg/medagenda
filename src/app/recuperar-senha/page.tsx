"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { BrandMark } from "@/components/decorations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim();
    if (!email) {
      setError("Informe o e-mail da sua conta.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
      }
    );

    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <BrandMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-tight">
          MedAgenda
        </span>
      </div>

      {sent ? (
        <>
          <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
            <MailCheck className="size-6" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Link enviado
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Se existir uma conta com esse e-mail, o link de redefinição chegou na
            caixa de entrada. Ele vale por uma hora.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">
            Recuperar senha
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enviamos um link para você criar uma senha nova.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail da conta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@clinica.com"
                required
              />
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
                <Send className="size-4" />
              )}
              Enviar link
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar para o login
        </Link>
      </p>
    </AuthShell>
  );
}
