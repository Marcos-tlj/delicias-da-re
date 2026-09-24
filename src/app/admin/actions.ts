"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { Category, OptionGroup, OrderStatus, Unit } from "@/lib/types";

const STATUSES: OrderStatus[] = ["pendente", "aceito", "em_preparo", "saiu_entrega", "finalizado", "cancelado"];

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (!STATUSES.includes(status)) return { error: "Status inválido" };
  const { supabase } = await requireAdmin();
  // O RLS também bloqueia qualquer não-admin, mesmo que chegue aqui.
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { error: "Não foi possível atualizar o pedido." };
  return { ok: true };
}

export async function setProductAvailability(productId: string, isAvailable: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").update({ is_available: isAvailable }).eq("id", productId);
  if (error) return { error: "Erro ao atualizar." };
  revalidatePath("/");
  revalidatePath("/admin/produtos");
  return { ok: true };
}

export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  category: Category;
  price: number;
  unit: Unit;
  min_quantity: number;
  quantity_step: number;
  price_is_from: boolean;
  is_available: boolean;
  sort_order: number;
  image_url: string | null;
  options: OptionGroup[];
};

function sanitize(input: ProductInput) {
  const categories: Category[] = ["bolos", "doces", "tortas"];
  const options: OptionGroup[] = (Array.isArray(input.options) ? input.options : [])
    .map((g) => ({
      name: String(g.name ?? "").trim().slice(0, 60),
      type: g.type === "multi" ? ("multi" as const) : ("single" as const),
      required: !!g.required,
      choices: Array.from(
        new Set((Array.isArray(g.choices) ? g.choices : []).map((c) => String(c).trim().slice(0, 60)).filter(Boolean)),
      ),
    }))
    .filter((g) => g.name && g.choices.length > 0);

  return {
    name: String(input.name ?? "").trim().slice(0, 80),
    description: String(input.description ?? "").trim().slice(0, 400) || null,
    category: categories.includes(input.category) ? input.category : "bolos",
    price: Math.max(0, Math.round(Number(input.price) * 100) / 100),
    unit: input.unit === "kg" ? "kg" : "un",
    min_quantity: Math.max(0.1, Number(input.min_quantity) || 1),
    quantity_step: Math.max(0.1, Number(input.quantity_step) || 1),
    price_is_from: !!input.price_is_from,
    is_available: !!input.is_available,
    sort_order: Math.trunc(Number(input.sort_order) || 0),
    image_url: input.image_url && /^https:\/\//.test(input.image_url) ? input.image_url : null,
    options,
  };
}

export async function saveProduct(input: ProductInput) {
  const { supabase } = await requireAdmin();
  const row = sanitize(input);
  if (row.name.length < 2) return { error: "Informe o nome do produto." };
  if (!Number.isFinite(row.price)) return { error: "Preço inválido." };

  const query = input.id
    ? supabase.from("products").update(row).eq("id", input.id).select("id").single()
    : supabase.from("products").insert(row).select("id").single();

  const { data, error } = await query;
  if (error) return { error: "Não foi possível salvar: " + error.message };

  revalidatePath("/");
  revalidatePath("/admin/produtos");
  return { ok: true, id: data.id as string };
}

export async function deleteProduct(productId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { error: "Não foi possível excluir." };
  revalidatePath("/");
  revalidatePath("/admin/produtos");
  return { ok: true };
}
