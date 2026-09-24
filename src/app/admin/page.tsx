import { requireAdmin } from "@/lib/admin";
import type { Order } from "@/lib/types";
import AdminOrders from "./AdminOrders";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Pedidos abertos (qualquer data) + tudo dos últimos 7 dias
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .or(`status.in.(pendente,aceito,em_preparo,saiu_entrega),created_at.gte.${since}`)
    .order("created_at", { ascending: false })
    .limit(200);

  return <AdminOrders initial={(data ?? []) as Order[]} />;
}
