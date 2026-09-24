import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { loadOrderFormData } from "@/lib/queries";
import type { Order } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import OrderForm from "@/components/OrderForm";

export const metadata = { title: "Editar pedido" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaff();
  const [{ data: order }, data] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)").eq("id", id).order("sort_order", { referencedTable: "order_items" }).maybeSingle(),
    loadOrderFormData(supabase),
  ]);
  if (!order) notFound();
  const o = order as Order;
  return (
    <>
      <PageHeader title={`Editar pedido #${o.code}`} back={{ href: `/pedidos/${o.id}`, label: `Pedido #${o.code}` }} />
      <OrderForm {...data} initial={o} />
    </>
  );
}
