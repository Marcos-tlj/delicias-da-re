import { requireStaff } from "@/lib/supabase/server";
import { loadOrderFormData } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import OrderForm from "@/components/OrderForm";

export const metadata = { title: "Novo pedido" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const { supabase } = await requireStaff();
  const data = await loadOrderFormData(supabase);
  return (
    <>
      <PageHeader title="Novo pedido" back={{ href: "/pedidos", label: "Pedidos" }} />
      <OrderForm {...data} initial={null} presetCustomerId={cliente} />
    </>
  );
}
