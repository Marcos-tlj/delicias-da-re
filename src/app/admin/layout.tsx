import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import AdminTabs from "./AdminTabs";

export const metadata = { title: "Painel — Delícias da Rê", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-cocoa px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-cream">
        <div className="flex items-center justify-between pb-2">
          <div>
            <p className="text-xs opacity-70">Olá, {profile?.full_name?.split(" ")[0] ?? "Rê"}</p>
            <p className="font-display text-lg font-semibold">Painel da Confeitaria</p>
          </div>
          <Link href="/" className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
            Ver loja
          </Link>
        </div>
        <AdminTabs />
      </header>
      {children}
    </div>
  );
}
