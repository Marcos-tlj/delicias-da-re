import { requireStaff } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const { supabase, user, name } = await requireStaff();
  const [{ data: emails }, { data: profiles }] = await Promise.all([
    supabase.from("allowed_emails").select("email, created_at").order("created_at"),
    supabase.from("profiles").select("email, full_name"),
  ]);
  const names = Object.fromEntries((profiles ?? []).map((p) => [p.email as string, p.full_name as string | null]));
  return (
    <>
      <PageHeader title="Configurações" subtitle="Quem tem acesso e sua conta" />
      <SettingsClient
        myEmail={user.email ?? ""}
        myName={name}
        team={(emails ?? []).map((e) => ({ email: e.email as string, name: names[e.email as string] ?? null }))}
      />
    </>
  );
}
