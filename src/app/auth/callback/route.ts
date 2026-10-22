import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Link de confirmação de e-mail ("Primeiro acesso"), de "Esqueci minha senha" e outros logins por link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // só caminhos internos (evita redirecionar para outro site)
  const nextParam = searchParams.get("next") ?? "/";
  const next = /^\/(?!\/)[\w\-/]*$/.test(nextParam) ? nextParam : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=link`);
}
