import { requireStaff } from "@/lib/supabase/server";
import { normalizeProduct } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import QuickSale from "./QuickSale";

export const metadata = { title: "Venda rápida" };

export default async function QuickSalePage() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("products").select("*").eq("is_active", true).order("category").order("sort_order").order("name");
  const products = (data ?? []).map(normalizeProduct);
  return (
    <>
      <PageHeader title="Venda rápida" subtitle="Para vendas no balcão, já pagas e entregues na hora" back={{ href: "/vendas", label: "Vendas" }} />
      <QuickSale products={products} />
    </>
  );
}
