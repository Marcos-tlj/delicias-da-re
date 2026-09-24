import "server-only";
import type { createClient } from "./supabase/server";
import type { Customer, OptionList, Product } from "./types";

export function normalizeProduct(p: Record<string, unknown>): Product {
  return {
    ...(p as unknown as Product),
    price: Number(p.price),
    stock_qty: Number(p.stock_qty),
    stock_min: Number(p.stock_min),
    option_groups: Array.isArray(p.option_groups) ? (p.option_groups as Product["option_groups"]) : [],
  };
}

/** Tudo o que o formulário de pedido precisa. */
export async function loadOrderFormData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [products, lists, customers] = await Promise.all([
    supabase.from("products").select("*").order("category").order("sort_order").order("name"),
    supabase.from("option_lists").select("*, option_items(*)").order("sort_order").order("name"),
    supabase.from("customers").select("id, name, phone, address, neighborhood").order("name").limit(5000),
  ]);
  return {
    products: (products.data ?? []).map(normalizeProduct),
    lists: (lists.data ?? []) as OptionList[],
    customers: (customers.data ?? []) as Pick<Customer, "id" | "name" | "phone" | "address" | "neighborhood">[],
  };
}
