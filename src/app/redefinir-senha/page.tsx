"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { BrandMark } from "@/components/decorations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Destino do link de recuperação. A sessão já foi criada pelo /auth/callback,
 * então aqui é só trocar a senha do usuário logado.
 */
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);
    if (authError) {
      setError(
        authError.message.toLowerCase().includes("session")
          ? "O link expirou. Peça um novo em “Esqueci minha senha”."
          : authError.message
      );
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <BrandMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-tight">
          MedAgenda
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">Nova senha</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Escolha uma senha nova para sua conta.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="mínimo 6 caracteres"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
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
            <KeyRound className="size-4" />
          )}
          Salvar nova senha
        </Button>
      </form>
    </AuthShell>
  );
}
