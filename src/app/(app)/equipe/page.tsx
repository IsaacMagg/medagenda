"use client";

import * as React from "react";
import { Lock, Mail, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, initials } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ClinicRole } from "@/lib/types";

const roleLabel: Record<ClinicRole, string> = {
  admin: "Administrador",
  recepcao: "Recepção",
};

export default function EquipePage() {
  const {
    member,
    isAdmin,
    members,
    invites,
    inviteMember,
    revokeInvite,
    setMemberRole,
    removeMember,
  } = useStore();

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<ClinicRole>("recepcao");
  const [sending, setSending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    kind: "ok" | "erro";
    text: string;
  } | null>(null);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setFeedback({ kind: "erro", text: "Informe o e-mail de quem vai entrar." });
      return;
    }
    setSending(true);
    const result = await inviteMember(email, role);
    setSending(false);
    if (!result.ok) {
      setFeedback({ kind: "erro", text: result.message ?? "Não foi possível convidar." });
      return;
    }
    setFeedback({
      kind: "ok",
      text: `Convite registrado. Peça para ${email.trim()} criar a conta em /cadastro usando exatamente esse e-mail.`,
    });
    setEmail("");
  }

  async function handleRemoveMember(userId: string, name: string) {
    const result = await removeMember(userId);
    if (!result.ok) {
      setFeedback({
        kind: "erro",
        text: `${name} não pôde ser removido: ${result.message ?? "sem permissão."}`,
      });
    }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          icon={Users}
          title="Equipe"
          description="Contas com acesso a esta clínica."
        />
        <Card>
          <CardContent className="px-6 py-16 text-center">
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Lock className="size-6" />
            </span>
            <p className="font-medium">Área restrita</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Só contas administradoras gerenciam a equipe. Sua conta está como{" "}
              <strong>{roleLabel[member?.role ?? "recepcao"]}</strong>.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Users}
        title="Equipe"
        description="Contas com acesso a esta clínica e o que cada uma pode fazer."
      />

      {feedback ? (
        <p
          role="alert"
          className={
            feedback.kind === "ok"
              ? "mb-5 rounded-xl border border-primary/30 bg-primary-soft/50 p-3.5 text-sm text-primary"
              : "mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Contas ativas ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const isSelf = m.userId === member?.userId;
                    return (
                      <TableRow key={m.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary">
                              {initials(m.name || m.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium">
                                {m.name || m.email.split("@")[0]}
                                {isSelf ? (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    você
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {m.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isSelf ? (
                            <Badge variant="default">
                              <ShieldCheck /> {roleLabel[m.role]}
                            </Badge>
                          ) : (
                            <Select
                              value={m.role}
                              onValueChange={(v) =>
                                setMemberRole(m.userId, v as ClinicRole)
                              }
                            >
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  Administrador
                                </SelectItem>
                                <SelectItem value="recepcao">
                                  Recepção
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(m.createdAt.slice(0, 10))}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {isSelf ? (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleRemoveMember(m.userId, m.name || m.email)
                                }
                                aria-label={`Remover acesso de ${m.name || m.email}`}
                                title="Remover acesso"
                              >
                                <Trash2 className="size-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {invites.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Convites aguardando cadastro ({invites.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">
                      {invite.email}
                    </span>
                    <Badge variant="secondary">{roleLabel[invite.role]}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvite(invite.id)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Convidar alguém</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="recepcao@clinica.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ClinicRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recepcao">Recepção</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  <UserPlus className="size-4" />
                  Registrar convite
                </Button>
              </form>

              <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                O convite não dispara e-mail. A pessoa cria a conta normalmente
                em <strong>/cadastro</strong>, na aba “Recebi um convite”, usando
                exatamente este e-mail — e entra já ligada a esta clínica.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">O que cada papel faz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Administrador</p>
                <p className="mt-1 text-muted-foreground">
                  Tudo da recepção, mais: cadastrar, editar e excluir médicos;
                  excluir pacientes; gerenciar a equipe.
                </p>
              </div>
              <div>
                <p className="font-medium">Recepção</p>
                <p className="mt-1 text-muted-foreground">
                  Cadastrar e editar pacientes, agendar consultas, enviar
                  confirmações e registrar atendimentos.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
