"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, UserPlus } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { BrandMark } from "@/components/decorations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Já existe uma conta com esse e-mail. Tente entrar pelo login.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("invalid email")) return "E-mail inválido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return message;
}

/**
 * Cadastro é só por convite.
 *
 * Criar clínica não passa por aqui: quem cria clínica é o dono da plataforma,
 * pela área /plataforma. Esta tela serve para quem foi convidado — o
 * administrador da clínica ou a recepção — usando o e-mail do convite.
 */
export default function CadastroPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name || !form.email || !form.password) {
      setError("Preencha nome, e-mail e senha.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (form.password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // O gatilho no banco procura um convite pendente para este e-mail e liga
    // a conta à clínica com o papel definido no convite.
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(translateAuthError(authError.message));
      setSubmitting(false);
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      router.replace("/login?cadastro=confirme");
    }
  }

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <BrandMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-tight">
          MedAgenda
        </span>
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">
        Tenho um convite
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Crie sua conta com o mesmo e-mail que a clínica usou para convidar você.
      </p>

      <div className="mt-6 flex gap-3 rounded-xl border border-primary/25 bg-primary-soft/40 p-3.5">
        <MailCheck className="mt-0.5 size-4.5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          O e-mail precisa ser exatamente o do convite. Se for outro, a conta é
          criada mas não entra em nenhuma clínica.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Seu nome</Label>
          <Input
            id="name"
            placeholder="Ana Souza"
            value={form.name}
            onChange={set("name")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail do convite</Label>
          <Input
            id="email"
            type="email"
            placeholder="recepcao@clinica.com"
            value={form.email}
            onChange={set("email")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="mínimo 6 caracteres"
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set("confirm")}
            />
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
            <UserPlus className="size-4" />
          )}
          {submitting ? "Criando conta…" : "Criar minha conta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem acesso?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
