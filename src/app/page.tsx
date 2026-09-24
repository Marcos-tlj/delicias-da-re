import { createPublicClient } from "@/lib/supabase/server";
import MenuClient from "@/components/MenuClient";
import type { Product } from "@/lib/types";

// O cardápio é cacheado por 60s (e revalidado na hora quando o admin salva algo).
export const revalidate = 60;

export default async function HomePage() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_available", true)
    .order("sort_order")
    .order("name");

  const products = (data ?? []).map((p) => ({
    ...p,
    price: Number(p.price),
    min_quantity: Number(p.min_quantity),
    quantity_step: Number(p.quantity_step),
  })) as Product[];

  return <MenuClient products={products} loadError={!!error} />;
}
