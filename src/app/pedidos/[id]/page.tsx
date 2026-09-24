import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import OrderTracker from "./OrderTracker";

export const metadata = { title: "Acompanhar pedido — Delícias da Rê" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string }>;
}) {
  const { id } = await params;
  const { novo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  // Se o pedido não for do usuário, o RLS devolve vazio => 404.
  const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <OrderTracker
      initial={data as Order}
      isNew={novo === "1"}
      whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? ""}
      pixKey={process.env.NEXT_PUBLIC_PIX_KEY ?? ""}
    />
  );
}
