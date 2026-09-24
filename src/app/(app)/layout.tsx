import AppShell from "@/components/AppShell";
import RealtimeRefresher from "@/components/RealtimeRefresher";
import { requireStaff } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireStaff();
  return (
    <AppShell userName={name}>
      <RealtimeRefresher />
      {children}
    </AppShell>
  );
}
