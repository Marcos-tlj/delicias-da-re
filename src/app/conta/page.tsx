import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import { signOut, updateProfile } from "./actions";

export const metadata = { title: "Minha conta — Delícias da Rê" };

const input = "w-full rounded-2xl border border-cream-dark bg-white px-4 py-3 outline-none focus:border-cocoa";

export default async function AccountPage() {
  const { user, profile } = await getSessionProfile();

  return (
    <div className="pb-28">
      <PageHeader title="Minha conta" />
      <div className="space-y-4 p-4">
        {profile?.is_admin && (
          <Link href="/admin" className="block rounded-3xl bg-cocoa p-5 text-cream">
            <p className="font-bold">👩‍🍳 Painel da confeitaria</p>
            <p className="text-sm opacity-80">Pedidos em tempo real e cardápio</p>
          </Link>
        )}

        <form action={updateProfile} className="space-y-3 rounded-3xl bg-white p-5">
          <p className="text-sm text-cocoa-light">{user?.email}</p>
          <label className="block">
            <span className="text-sm font-bold">Nome</span>
            <input name="full_name" defaultValue={profile?.full_name ?? ""} className={`${input} mt-1`} />
          </label>
          <label className="block">
            <span className="text-sm font-bold">WhatsApp</span>
            <input name="phone" inputMode="tel" defaultValue={profile?.phone ?? ""} className={`${input} mt-1`} />
          </label>
          <button className="w-full rounded-2xl bg-cocoa py-3 font-bold text-cream">Salvar</button>
        </form>

        <form action={signOut}>
          <button className="w-full rounded-2xl border border-cream-dark bg-white py-3 font-bold text-berry">Sair</button>
        </form>
      </div>
    </div>
  );
}
