import "server-only";
import type { createClient } from "./supabase/server";
import type { Customer, Ingredient, IngredientKind, IngredientUnit, OptionList, Product, RecipeLine } from "./types";
import { isUnit } from "./ingredients";

export function normalizeProduct(p: Record<string, unknown>): Product {
  return {
    ...(p as unknown as Product),
    price: Number(p.price),
    stock_qty: Number(p.stock_qty),
    stock_min: Number(p.stock_min),
    cost: Number(p.cost ?? 0),
    margin_pct: Number(p.margin_pct ?? 100),
    margin_mode: p.margin_mode === "margin" ? "margin" : "markup",
    price_auto: !!p.price_auto,
    price_rounding: Number(p.price_rounding ?? 0.5),
    cost_items: Array.isArray(p.cost_items)
      ? (p.cost_items as { name?: unknown; value?: unknown }[]).map((c) => ({ name: String(c.name ?? ""), value: Number(c.value) || 0 }))
      : [],
    option_groups: Array.isArray(p.option_groups) ? (p.option_groups as Product["option_groups"]) : [],
    recipe: normalizeRecipe(p.recipe),
    recipe_yield: Number(p.recipe_yield) > 0 ? Number(p.recipe_yield) : 1,
    packaging: normalizeRecipe(p.packaging),
  };
}

export function normalizeRecipe(r: unknown): RecipeLine[] {
  if (!Array.isArray(r)) return [];
  return (r as { ingredient_id?: unknown; qty?: unknown; unit?: unknown }[])
    .filter((l) => typeof l?.ingredient_id === "string")
    .map((l) => ({ ingredient_id: String(l.ingredient_id), qty: Number(l.qty) || 0, unit: (isUnit(l.unit) ? l.unit : "g") as IngredientUnit }));
}

export function normalizeIngredient(i: Record<string, unknown>): Ingredient {
  return {
    id: String(i.id),
    name: String(i.name ?? ""),
    kind: (i.kind === "embalagem" || i.kind === "outro" ? i.kind : "ingrediente") as IngredientKind,
    unit: (isUnit(i.unit) ? i.unit : "g") as IngredientUnit,
    package_qty: Number(i.package_qty) || 0,
    package_price: Number(i.package_price) || 0,
    notes: (i.notes as string | null) ?? null,
    updated_at: String(i.updated_at ?? ""),
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
