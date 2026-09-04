import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/** Rotas que exigem clínica autenticada. */
const PROTECTED = [
  "/dashboard",
  "/pacientes",
  "/agenda",
  "/medicos",
  "/equipe",
  "/administracao",
];
/** Rotas de autenticação: quem já entrou não deveria ver. */
const AUTH_ONLY = ["/login", "/cadastro"];

/**
 * Renova a sessão a cada requisição e decide quem pode ver o quê.
 *
 * A proteção acontece no servidor, antes de qualquer HTML chegar ao
 * navegador — o RLS do banco continua sendo a segunda barreira.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Não coloque nada entre createServerClient e getUser: é essa chamada que
  // revalida o token e mantém a sessão viva.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthOnly = AUTH_ONLY.some((route) => pathname.startsWith(route));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
