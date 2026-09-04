"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { BrandMark } from "@/components/decorations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCNPJ, formatDate, isValidCNPJ, onlyDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type ClinicRecord = {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string | null;
  created_at: string;
};

function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Senha inicial forte, para entregar à clínica. */
function gerarSenha(): string {
  const abc = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => abc[n % abc.length]).join("");
}

const vazio = { name: "", cnpj: "", phone: "", email: "", password: "" };

type Detalhe = {
  clinic: ClinicRecord;
  members: { user_id: string; email: string; role: string }[];
  counts: {
    patients: number;
    doctors: number;
    appointments: number;
    consultations: number;
  };
};

/**
 * Administração: o único lugar onde uma clínica é criada.
 *
 * A clínica não se cadastra — aqui a conta de acesso dela já nasce pronta,
 * com o e-mail confirmado. A criação passa por /api/administracao/clinicas,
 * que confere a permissão no servidor antes de usar poderes de administrador.
 */
export default function AdministracaoPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [checking, setChecking] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);
  const [clinics, setClinics] = React.useState<ClinicRecord[]>([]);

  const [form, setForm] = React.useState(vazio);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  /** Credenciais da última clínica criada, para repassar. */
  const [criada, setCriada] = React.useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiado, setCopiado] = React.useState(false);

  /** Clínica aberta para edição, com a senha em branco = "não mexer". */
  const [editando, setEditando] = React.useState<ClinicRecord | null>(null);
  const [editForm, setEditForm] = React.useState(vazio);
  const [salvandoEdicao, setSalvandoEdicao] = React.useState(false);
  const [erroEdicao, setErroEdicao] = React.useState<string | null>(null);

  /** Clínica na fila para exclusão, junto do que será apagado com ela. */
  const [excluindo, setExcluindo] = React.useState<Detalhe | null>(null);
  const [confirmacao, setConfirmacao] = React.useState("");
  const [apagando, setApagando] = React.useState(false);
  const [erroExclusao, setErroExclusao] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setChecking(true);
    const owner = await supabase.rpc("is_platform_owner");
    const ok = owner.data === true;
    setAllowed(ok);

    if (ok) {
      const { data } = await supabase
        .from("clinics")
        .select("*")
        .order("created_at", { ascending: false });
      setClinics((data ?? []) as ClinicRecord[]);
    }
    setChecking(false);
  }, [supabase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    setCriada(null);

    if (!form.name.trim() || !form.cnpj || !form.email.trim() || !form.password) {
      setErro("Preencha nome, CNPJ, e-mail e senha.");
      return;
    }
    if (!isValidCNPJ(form.cnpj)) {
      setErro("CNPJ inválido — confira os números.");
      return;
    }
    if (form.password.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/administracao/clinicas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        cnpj: formatCNPJ(form.cnpj),
        phone: onlyDigits(form.phone),
        email: form.email.trim(),
        password: form.password,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setErro(body.error ?? "Não foi possível criar a clínica.");
      return;
    }

    setCriada({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    setCopiado(false);
    setForm(vazio);
    void load();
  }

  function abrirEdicao(clinic: ClinicRecord) {
    setErroEdicao(null);
    setEditForm({
      name: clinic.name,
      cnpj: clinic.cnpj ?? "",
      phone: clinic.phone ?? "",
      email: clinic.email,
      password: "",
    });
    setEditando(clinic);
  }

  async function salvarEdicao(event: React.FormEvent) {
    event.preventDefault();
    if (!editando) return;

    if (!editForm.name.trim()) {
      setErroEdicao("O nome da clínica não pode ficar vazio.");
      return;
    }
    if (editForm.cnpj && !isValidCNPJ(editForm.cnpj)) {
      setErroEdicao("CNPJ inválido — confira os números.");
      return;
    }
    if (editForm.password && editForm.password.length < 8) {
      setErroEdicao("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setSalvandoEdicao(true);
    setErroEdicao(null);

    const response = await fetch(
      `/api/administracao/clinicas/${editando.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          cnpj: editForm.cnpj ? formatCNPJ(editForm.cnpj) : "",
          phone: onlyDigits(editForm.phone),
          email: editForm.email.trim(),
          // Vazio = mantém a senha atual.
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      }
    );
    const body = await response.json().catch(() => ({}));
    setSalvandoEdicao(false);

    if (!response.ok) {
      setErroEdicao(body.error ?? "Não foi possível salvar.");
      return;
    }
    setEditando(null);
    void load();
  }

  async function abrirExclusao(clinic: ClinicRecord) {
    setErroExclusao(null);
    setConfirmacao("");
    const response = await fetch(`/api/administracao/clinicas/${clinic.id}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setErro(body.error ?? "Não foi possível abrir a clínica.");
      return;
    }
    setExcluindo(body as Detalhe);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setApagando(true);
    setErroExclusao(null);

    const response = await fetch(
      `/api/administracao/clinicas/${excluindo.clinic.id}`,
      { method: "DELETE" }
    );
    const body = await response.json().catch(() => ({}));
    setApagando(false);

    if (!response.ok) {
      setErroExclusao(body.error ?? "Não foi possível excluir.");
      return;
    }
    setExcluindo(null);
    // Se o dono acabou de apagar a clínica em que ele mesmo estava, o store
    // precisa recarregar para o menu se ajustar.
    router.refresh();
    void load();
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-clinic">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-11 animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <AppShell requireClinic={false}>
        <Card className="mx-auto max-w-md">
          <CardContent className="px-8 py-12 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-6" />
            </span>
            <p className="font-display text-lg font-semibold">Área restrita</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Só a conta responsável pela plataforma cadastra clínicas.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => router.replace("/dashboard")}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell requireClinic={false}>
      <>
        <div className="mb-7 flex items-start gap-3.5">
          <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Building2 className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-[1.7rem] font-semibold tracking-tight">
              Administração
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Cadastro de clínicas. A conta de acesso é criada aqui — a clínica
              não precisa se cadastrar.
            </p>
          </div>
        </div>

        {criada ? (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary-soft/50 p-4">
            <p className="font-medium text-primary">
              {criada.name} criada e pronta para entrar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Entregue estas credenciais à clínica. A senha não aparece de novo
              depois que você sair desta tela.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 font-mono text-sm">
              <span>{criada.email}</span>
              <span className="text-muted-foreground">·</span>
              <span>{criada.password}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `E-mail: ${criada.email}\nSenha: ${criada.password}`
                  );
                  setCopiado(true);
                }}
              >
                {copiado ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        ) : null}

        {erro ? (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive"
          >
            {erro}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Clínicas cadastradas ({clinics.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {clinics.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Building2 className="size-6" />
                  </span>
                  <p className="font-medium">Nenhuma clínica ainda</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Cadastre a primeira no formulário ao lado.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clínica</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Conta de acesso</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinics.map((clinic) => (
                      <TableRow key={clinic.id}>
                        <TableCell className="font-medium">
                          {clinic.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {clinic.cnpj || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {clinic.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(clinic.created_at.slice(0, 10))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirEdicao(clinic)}
                            >
                              <Pencil className="size-4" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirExclusao(clinic)}
                              aria-label={`Excluir ${clinic.name}`}
                              title="Excluir"
                            >
                              <Trash2 className="size-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Nova clínica</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Nome da clínica</Label>
                  <Input
                    id="c-name"
                    placeholder="Clínica Vida Plena"
                    value={form.name}
                    onChange={set("name")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="c-cnpj">CNPJ</Label>
                  <Input
                    id="c-cnpj"
                    inputMode="numeric"
                    placeholder="00.000.000/0001-00"
                    value={form.cnpj}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, cnpj: maskCNPJ(e.target.value) }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="c-phone">Telefone</Label>
                  <Input
                    id="c-phone"
                    inputMode="tel"
                    placeholder="(11) 3333-4444"
                    value={form.phone}
                    onChange={set("phone")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="c-email">E-mail de acesso</Label>
                  <Input
                    id="c-email"
                    type="email"
                    placeholder="contato@clinica.com"
                    value={form.email}
                    onChange={set("email")}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="c-password">Senha inicial</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() =>
                        setForm((p) => ({ ...p, password: gerarSenha() }))
                      }
                    >
                      Gerar senha
                    </button>
                  </div>
                  <Input
                    id="c-password"
                    className="font-mono"
                    placeholder="mínimo 8 caracteres"
                    value={form.password}
                    onChange={set("password")}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Criar clínica e conta
                </Button>
              </form>

              <div className="mt-5 flex gap-3 border-t border-border pt-4">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  A conta nasce com o e-mail já confirmado e o papel de
                  administrador da clínica. Ela entra direto pelo{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    login
                  </Link>{" "}
                  e depois convida a própria recepção.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------ edição */}
        <Dialog
          open={editando !== null}
          onOpenChange={(open) => !open && setEditando(null)}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar {editando?.name}</DialogTitle>
              <DialogDescription>
                Mudar o e-mail troca também o login da clínica. A senha só é
                alterada se você preencher o campo.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={salvarEdicao} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="e-name">Nome da clínica</Label>
                <Input
                  id="e-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="e-cnpj">CNPJ</Label>
                  <Input
                    id="e-cnpj"
                    inputMode="numeric"
                    value={editForm.cnpj}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        cnpj: maskCNPJ(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-phone">Telefone</Label>
                  <Input
                    id="e-phone"
                    inputMode="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="e-email">E-mail de acesso</Label>
                <Input
                  id="e-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="e-password">Nova senha</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      setEditForm((p) => ({ ...p, password: gerarSenha() }))
                    }
                  >
                    Gerar senha
                  </button>
                </div>
                <Input
                  id="e-password"
                  className="font-mono"
                  placeholder="deixe vazio para manter a senha atual"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>

              {erroEdicao ? (
                <p className="text-sm text-destructive" role="alert">
                  {erroEdicao}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoEdicao}>
                  {salvandoEdicao ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Salvar alterações
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ---------------------------------------------------- exclusão */}
        <Dialog
          open={excluindo !== null}
          onOpenChange={(open) => !open && setExcluindo(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Excluir {excluindo?.clinic.name}?
              </DialogTitle>
              <DialogDescription>
                Isso apaga a clínica e tudo que pertence a ela. Não tem volta.
              </DialogDescription>
            </DialogHeader>

            {excluindo ? (
              <>
                <ul className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  {[
                    ["Pacientes", excluindo.counts.patients],
                    ["Médicos", excluindo.counts.doctors],
                    ["Agendamentos", excluindo.counts.appointments],
                    ["Consultas registradas", excluindo.counts.consultations],
                    ["Contas de acesso", excluindo.members.length],
                  ].map(([label, n]) => (
                    <li key={label} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{n}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  <Label htmlFor="confirma">
                    Para confirmar, digite{" "}
                    <span className="font-semibold">
                      {excluindo.clinic.name}
                    </span>
                  </Label>
                  <Input
                    id="confirma"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    placeholder={excluindo.clinic.name}
                  />
                </div>
              </>
            ) : null}

            {erroExclusao ? (
              <p className="text-sm text-destructive" role="alert">
                {erroExclusao}
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setExcluindo(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={
                  apagando ||
                  confirmacao.trim() !== (excluindo?.clinic.name ?? "")
                }
                onClick={confirmarExclusao}
              >
                {apagando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Excluir definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </AppShell>
  );
}
