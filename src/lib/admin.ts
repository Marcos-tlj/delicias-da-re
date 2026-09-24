import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile } from "./supabase/server";

/** Segunda barreira (além do middleware e do RLS): exige is_admin = true. */
export async function requireAdmin() {
  const { supabase, user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/admin");
  if (!profile?.is_admin) redirect("/");
  return { supabase, user, profile };
}
