import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Cliente com a chave service_role.
 *
 * ⚠️ ELE IGNORA TODO O RLS. Só pode ser usado dentro de Route Handlers e
 * Server Actions, e só depois de conferir quem está chamando. O import
 * "server-only" acima faz o build quebrar se este arquivo for parar em
 * qualquer componente de cliente.
 *
 * Hoje existe por um motivo só: criar a conta de acesso da clínica sem que a
 * clínica precise se cadastrar sozinha.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está definida. Preencha em .env.local — Supabase → Project Settings → API → service_role."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
