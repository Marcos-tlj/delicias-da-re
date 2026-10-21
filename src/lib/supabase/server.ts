import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* Server Component: o middleware renova a sessão */
          }
        },
      },
    },
  );
}

/**
 * Exige usuário logado com acesso liberado. Use em toda página/ação interna.
 * `cache` faz o layout e a página dividirem a mesma verificação na mesma requisição.
 */
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // permissão e nome em paralelo (antes eram uma depois da outra)
  const [{ data: ok }, { data: profile }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
  ]);
  if (!ok) redirect("/login?erro=acesso");

  return {
    supabase,
    user,
    name: (profile?.full_name as string | null) || user.email?.split("@")[0] || "Equipe",
  };
});
