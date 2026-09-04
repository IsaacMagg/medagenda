import "server-only";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Guard =
  | { error: NextResponse; userId?: undefined; admin?: undefined }
  | {
      error?: undefined;
      userId: string;
      admin: ReturnType<typeof createAdminClient>;
    };

/**
 * Portão de entrada das rotas de administração.
 *
 * Confere pela sessão de quem chamou que é mesmo o dono da plataforma, e só
 * então devolve o cliente com poderes de administrador. Nenhuma rota deve
 * tocar na service_role sem passar por aqui.
 */
export async function requirePlatformOwner(): Promise<Guard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: isOwner, error: ownerError } = await supabase.rpc(
    "is_platform_owner"
  );

  if (ownerError) {
    return {
      error: NextResponse.json(
        {
          error: `Não foi possível verificar a permissão: ${ownerError.message}`,
        },
        { status: 500 }
      ),
    };
  }

  if (isOwner !== true) {
    return {
      error: NextResponse.json(
        { error: "Só o responsável pela plataforma administra clínicas." },
        { status: 403 }
      ),
    };
  }

  try {
    return { userId: user.id, admin: createAdminClient() };
  } catch (e) {
    return {
      error: NextResponse.json(
        { error: e instanceof Error ? e.message : "Configuração incompleta." },
        { status: 500 }
      ),
    };
  }
}
