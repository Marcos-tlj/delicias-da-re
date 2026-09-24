import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl, formatDateTime } from "@/lib/format";
import type { Order } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Meus pedidos — Delícias da Rê" };

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS garante que só voltam os pedidos do próprio usuário;
  // o filtro explícito evita que uma admin veja todos aqui.
  const { data } = await supabase
    .from("orders")
    .select("id, code, status, delivery_type, total, created_at, order_items(count)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (data ?? []) as (Pick<Order, "id" | "code" | "status" | "delivery_type" | "total" | "created_at"> & {
    order_items: { count: number }[];
  })[];

  return (
    <div className="pb-28">
      <PageHeader title="Meus pedidos" />
      {orders.length === 0 ? (
        <div className="p-10 text-center">
          <span className="text-5xl">📋</span>
          <p className="mt-3 font-bold">Nenhum pedido ainda</p>
          <Link href="/" className="mt-4 inline-block font-bold text-berry">
            Fazer meu primeiro pedido
          </Link>
        </div>
      ) : (
        <ul className="space-y-3 p-4">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/pedidos/${o.id}`} className="block rounded-3xl bg-white p-4 active:bg-cream-dark">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Pedido #{o.code}</span>
                  <StatusBadge status={o.status} delivery={o.delivery_type} />
                </div>
                <div className="mt-2 flex justify-between text-sm text-cocoa-light">
                  <span>
                    {formatDateTime(o.created_at)} · {o.order_items[0]?.count ?? 0} item(ns)
                  </span>
                  <span className="font-bold text-cocoa">{brl(o.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
