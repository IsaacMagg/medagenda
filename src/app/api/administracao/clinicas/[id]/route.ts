import { NextResponse, type NextRequest } from "next/server";

import { requirePlatformOwner } from "@/lib/api/owner-guard";

type Ctx = { params: Promise<{ id: string }> };

/**
 * A conta principal da clínica: o membro administrador cujo e-mail bate com o
 * cadastro. É essa que a tela de administração edita.
 */
async function contaPrincipal(
  admin: NonNullable<Awaited<ReturnType<typeof requirePlatformOwner>>["admin"]>,
  clinicId: string,
  clinicEmail: string
) {
  const { data: members } = await admin
    .from("clinic_members")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at");

  const lista = members ?? [];
  return (
    lista.find(
      (m) =>
        m.role === "admin" &&
        m.email.toLowerCase() === clinicEmail.toLowerCase()
    ) ??
    lista.find((m) => m.role === "admin") ??
    lista[0] ??
    null
  );
}

/** Dados da clínica + o tamanho do estrago, para uma exclusão informada. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePlatformOwner();
  if (guard.error) return guard.error;
  const { admin } = guard;
  const { id } = await ctx.params;

  const { data: clinic, error } = await admin
    .from("clinics")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !clinic) {
    return NextResponse.json(
      { error: "Clínica não encontrada." },
      { status: 404 }
    );
  }

  const contar = async (tabela: "patients" | "doctors" | "appointments" | "consultations") => {
    const { count } = await admin
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", id);
    return count ?? 0;
  };

  const { data: members } = await admin
    .from("clinic_members")
    .select("user_id,email,role")
    .eq("clinic_id", id);

  const [patients, doctors, appointments, consultations] = await Promise.all([
    contar("patients"),
    contar("doctors"),
    contar("appointments"),
    contar("consultations"),
  ]);

  return NextResponse.json({
    clinic,
    members: members ?? [],
    counts: { patients, doctors, appointments, consultations },
  });
}

/** Edita a clínica e, se pedido, o e-mail e a senha da conta de acesso. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const guard = await requirePlatformOwner();
  if (guard.error) return guard.error;
  const { admin } = guard;
  const { id } = await ctx.params;

  let body: {
    name?: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    password?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { data: clinic } = await admin
    .from("clinics")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!clinic) {
    return NextResponse.json(
      { error: "Clínica não encontrada." },
      { status: 404 }
    );
  }

  const name = body.name?.trim() ?? clinic.name;
  const email = (body.email?.trim() ?? clinic.email).toLowerCase();
  const password = body.password ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "O nome da clínica não pode ficar vazio." },
      { status: 400 }
    );
  }
  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  const conta = await contaPrincipal(admin, id, clinic.email);
  const emailMudou = email !== clinic.email.toLowerCase();

  // 1. Conta de acesso primeiro: se falhar, nada mais é alterado.
  if (conta && (emailMudou || password)) {
    const patch: { email?: string; password?: string; email_confirm?: boolean } =
      {};
    if (emailMudou) {
      patch.email = email;
      patch.email_confirm = true; // não obrigamos a clínica a reconfirmar
    }
    if (password) patch.password = password;

    const { error: authError } = await admin.auth.admin.updateUserById(
      conta.user_id,
      patch
    );

    if (authError) {
      const msg = authError.message.toLowerCase();
      return NextResponse.json(
        {
          error:
            msg.includes("already") || msg.includes("registered")
              ? "Já existe outra conta com esse e-mail."
              : authError.message,
        },
        { status: 400 }
      );
    }

    if (emailMudou) {
      await admin
        .from("clinic_members")
        .update({ email })
        .eq("user_id", conta.user_id);
    }
  }

  // 2. Dados da clínica
  const { data: updated, error: updateError } = await admin
    .from("clinics")
    .update({
      name,
      cnpj: body.cnpj?.trim() ?? clinic.cnpj,
      phone: body.phone?.trim() || null,
      email,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Não foi possível salvar." },
      { status: 500 }
    );
  }

  return NextResponse.json({ clinic: updated, contaAtualizada: !!conta });
}

/**
 * Exclui a clínica e as contas de acesso dela.
 *
 * Apagar a clínica derruba em cascata pacientes, médicos, agendamentos,
 * consultas, membros e convites. Os usuários do auth não caem por cascata, por
 * isso são removidos aqui — menos o próprio dono da plataforma, para ninguém
 * apagar a própria conta sem querer.
 */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const guard = await requirePlatformOwner();
  if (guard.error) return guard.error;
  const { admin, userId } = guard;
  const { id } = await ctx.params;

  const { data: clinic } = await admin
    .from("clinics")
    .select("id,name")
    .eq("id", id)
    .maybeSingle();

  if (!clinic) {
    return NextResponse.json(
      { error: "Clínica não encontrada." },
      { status: 404 }
    );
  }

  const { data: members } = await admin
    .from("clinic_members")
    .select("user_id,email")
    .eq("clinic_id", id);

  const { error: deleteError } = await admin
    .from("clinics")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: `Não foi possível excluir: ${deleteError.message}` },
      { status: 500 }
    );
  }

  let contaPropriaPreservada = false;
  for (const m of members ?? []) {
    if (m.user_id === userId) {
      contaPropriaPreservada = true; // nunca apagamos quem está operando
      continue;
    }
    await admin.auth.admin.deleteUser(m.user_id);
  }

  return NextResponse.json({
    ok: true,
    name: clinic.name,
    contasRemovidas: (members ?? []).filter((m) => m.user_id !== userId).length,
    contaPropriaPreservada,
  });
}
