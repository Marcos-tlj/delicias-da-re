import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Link de confirmação de e-mail ("Primeiro acesso") e outros logins por link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?erro=link`);
}
