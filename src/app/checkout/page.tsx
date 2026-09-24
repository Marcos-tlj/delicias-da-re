import { getSessionProfile } from "@/lib/supabase/server";
import CheckoutForm from "./CheckoutForm";

export const metadata = { title: "Finalizar pedido — Delícias da Rê" };

export default async function CheckoutPage() {
  const { profile, user } = await getSessionProfile();
  return (
    <CheckoutForm
      defaultName={profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? ""}
      defaultPhone={profile?.phone ?? ""}
    />
  );
}
