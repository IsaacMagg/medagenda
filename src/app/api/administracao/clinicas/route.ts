import { NextResponse, type NextRequest } from "next/server";

import { requirePlatformOwner } from "@/lib/api/owner-guard";

/**
 * Cria uma clínica JUNTO com a conta de acesso dela.
 *
 * A clínica não se cadastra: o dono da plataforma preenche os dados e a conta
 * já nasce pronta para entrar, com o e-mail confirmado.
 *
 * A chave service_role só entra em ação DEPOIS de confirmar, pela sessão de
 * quem chamou, que é mesmo o dono da plataforma.
 */
export async function POST(request: NextRequest) {
  // 1. Só o dono da plataforma passa daqui
  const guard = await requirePlatformOwner();
  if (guard.error) return guard.error;
  const { admin } = guard;

  // 2. Validação dos dados
  let payload: {
    name?: string;
    cnpj?: string;
    phone?: string;
    email?: string;
    password?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const name = payload.name?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  const cnpj = payload.cnpj?.trim() ?? "";
  const phone = payload.phone?.trim() ?? "";

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nome da clínica, e-mail e senha são obrigatórios." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "A senha precisa ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  // 3a. Cria a conta de acesso já confirmada — a clínica entra direto.
  const { data: created, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

  if (createUserError || !created?.user) {
    const msg = createUserError?.message ?? "Não foi possível criar a conta.";
    return NextResponse.json(
      {
        error: msg.toLowerCase().includes("already")
          ? "Já existe uma conta com esse e-mail."
          : msg,
      },
      { status: 400 }
    );
  }

  const newUserId = created.user.id;

  // 3b. Cria a clínica
  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({ name, cnpj, email, phone: phone || null })
    .select("*")
    .single();

  if (clinicError || !clinic) {
    // Desfaz a conta para não deixar usuário órfão.
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: clinicError?.message ?? "Não foi possível criar a clínica." },
      { status: 500 }
    );
  }

  // 3c. Liga a conta à clínica como administradora
  const { error: memberError } = await admin.from("clinic_members").insert({
    user_id: newUserId,
    clinic_id: clinic.id,
    name,
    email,
    role: "admin",
  });

  if (memberError) {
    await admin.from("clinics").delete().eq("id", clinic.id);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Não foi possível vincular a conta: ${memberError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ clinic }, { status: 201 });
}
