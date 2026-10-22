"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireStaff } from "@/lib/supabase/server";
import type { Category, CostItem, OptionList, ExpenseCategory, IngredientKind, IngredientUnit, MarginMode, OptionGroup, OrderStatus, PaymentMethod, RecipeLine, SelectedOptions, Unit } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { calcPrice } from "@/lib/pricing";
import { costParts, isUnit, linesCost, recipeCost, unitInfo } from "@/lib/ingredients";
import { MAX_LAYERS, itemUnitCost } from "@/lib/layers";
import { normalizeIngredient, normalizeProduct, normalizeRecipe } from "@/lib/queries";

type Result = { ok?: boolean; error?: string; id?: string };

const STATUSES: OrderStatus[] = ["novo", "confirmado", "em_preparo", "pronto", "entregue", "cancelado"];

function dbError(e: { message?: string; code?: string } | null, fallback: string) {
  if (!e) return fallback;
  // mensagens escritas por nós no banco (raise exception) são seguras para mostrar
  if (e.code === "P0001" && e.message) return e.message;
  return fallback;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

// ======================= Sessão =======================
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ======================= Pedidos =======================
export type OrderPayload = {
  id?: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_type: "retirada" | "entrega";
  address: string;
  due_at: string | null;
  payment_method: PaymentMethod | "";
  amount_paid: number;
  delivery_fee: number;
  discount: number;
  notes: string;
  status?: OrderStatus;
  items: {
    product_id: string | null;
    product_name: string;
    unit: Unit;
    unit_price: number;
    quantity: number;
    options: SelectedOptions;
    note: string | null;
  }[];
};

/**
 * Custo de cada item do pedido, calculado aqui no servidor:
 * custo do produto + custo dos sabores escolhidos + custo fixo (caixa…) ÷ quantidade.
 * Ao editar, item que não mudou mantém o custo gravado (o lucro antigo não muda).
 */
async function withCosts(supabase: Supa, orderId: string | undefined, items: OrderPayload["items"]) {
  const pids = [...new Set(items.map((i) => i.product_id).filter(isId))];
  if (!pids.length) return items;
  const [{ data: prods }, { data: lists }, old] = await Promise.all([
    supabase.from("products").select("*").in("id", pids),
    supabase.from("option_lists").select("id, name, sort_order, price_per_kg, option_items(id, list_id, name, is_active, sort_order, cost)"),
    orderId
      ? supabase.from("order_items").select("product_id, quantity, options, unit_cost").eq("order_id", orderId)
      : Promise.resolve({ data: [] as { product_id: string | null; quantity: unknown; options: unknown; unit_cost: unknown }[] }),
  ]);
  const byId = new Map((prods ?? []).map((r) => [String(r.id), normalizeProduct(r)]));
  // o banco reordena as chaves do JSON: compara em ordem alfabética
  const canon = (o: unknown) =>
    JSON.stringify(Object.entries((o ?? {}) as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)));
  const sameOpts = (a: unknown, b: unknown) => canon(a) === canon(b);
  return items.map((i) => {
    const prod = i.product_id ? byId.get(i.product_id) : undefined;
    if (!prod) return i;
    const kept = (old.data ?? []).find(
      (o) => o.product_id === i.product_id && Number(o.quantity) === Number(i.quantity) && sameOpts(o.options, i.options) && Number(o.unit_cost) > 0,
    );
    const unit_cost = kept ? Number(kept.unit_cost) : itemUnitCost(prod, i.options as SelectedOptions, (lists ?? []) as OptionList[], i.quantity);
    return { ...i, unit_cost: Math.round(unit_cost * 100) / 100 };
  });
}

export async function saveOrder(p: OrderPayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const { items, ...order } = p;
  const priced = await withCosts(supabase, p.id, items ?? []);
  const { data, error } = await supabase.rpc("save_order", { p_order: order, p_items: priced });
  if (error) return { error: dbError(error, "Não foi possível salvar o pedido.") };
  refreshAll();
  return { ok: true, id: data as string };
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<Result> {
  if (!STATUSES.includes(status)) return { error: "Status inválido." };
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) return { error: dbError(error, "Não foi possível mudar o status.") };
  refreshAll();
  return { ok: true };
}

export async function setAmountPaid(id: string, amount: number): Promise<Result> {
  const { supabase } = await requireStaff();
  const value = Math.max(0, Math.round(Number(amount) * 100) / 100);
  if (!Number.isFinite(value)) return { error: "Valor inválido." };
  const { error } = await supabase.from("orders").update({ amount_paid: value }).eq("id", id);
  if (error) return { error: "Não foi possível registrar o pagamento." };
  refreshAll();
  return { ok: true };
}

export async function deleteOrder(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o pedido." };
  refreshAll();
  return { ok: true };
}

// ======================= Clientes =======================
export type CustomerPayload = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  neighborhood: string;
  notes: string;
};

export async function saveCustomer(p: CustomerPayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const row = {
    name: p.name.trim().slice(0, 120),
    phone: p.phone.trim() || null,
    email: p.email.trim().toLowerCase() || null,
    address: p.address.trim() || null,
    neighborhood: p.neighborhood.trim() || null,
    notes: p.notes.trim() || null,
  };
  if (!row.name) return { error: "Informe o nome." };
  const q = p.id
    ? supabase.from("customers").update(row).eq("id", p.id).select("id").single()
    : supabase.from("customers").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: "Não foi possível salvar o cliente." };
  refreshAll();
  return { ok: true, id: data.id as string };
}

export async function deleteCustomer(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o cliente." };
  refreshAll();
  return { ok: true };
}

// ======================= Produtos =======================
export type ProductPayload = {
  id?: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  unit: Unit;
  price_is_from: boolean;
  is_active: boolean;
  stock_enabled: boolean;
  stock_qty: number;
  stock_min: number;
  sort_order: number;
  option_groups: OptionGroup[];
  cost: number;
  cost_items: CostItem[];
  margin_pct: number;
  margin_mode: MarginMode;
  price_auto: boolean;
  price_rounding: number;
  recipe: RecipeLine[];
  recipe_yield: number;
  packaging: RecipeLine[];
};

const money2 = (v: unknown) => Math.max(0, Math.round(Number(v) * 100) / 100 || 0);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function cleanGroups(groups: OptionGroup[] | undefined): OptionGroup[] {
  const out: OptionGroup[] = [];
  let hasLayers = false;
  for (const g of groups ?? []) {
    const label = String(g?.label ?? "").trim().slice(0, 40);
    if (!label) continue;
    if (g.kind === "layers" && !hasLayers) {
      const ids = [...new Set((g.list_ids ?? []).filter(isId))].slice(0, 10);
      if (!ids.length) continue;
      hasLayers = true; // só um grupo de camadas por produto
      out.push({ label, kind: "layers", list_id: ids[0], list_ids: ids, layers: Math.min(MAX_LAYERS, Math.max(1, Math.round(Number(g.layers) || 2))), required: !!g.required, multi: false });
    } else if (g.kind !== "layers" && isId(g.list_id)) {
      out.push({ label, list_id: g.list_id, required: !!g.required, multi: !!g.multi });
    }
  }
  return out.slice(0, 12);
}

export async function saveProduct(p: ProductPayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const categories: Category[] = ["bolos", "doces", "tortas", "outros"];
  const costItems = (p.cost_items ?? [])
    .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 60), value: money2(c.value) }))
    .filter((c) => c.name || c.value)
    .slice(0, 40);
  const recipe = cleanRecipe(p.recipe);
  const recipeYield = Math.round(Number(p.recipe_yield) * 1000) / 1000 > 0 ? Math.round(Number(p.recipe_yield) * 1000) / 1000 : 1;
  const packaging = cleanRecipe(p.packaging);
  const unit = p.unit === "kg" ? "kg" : "un";
  let cost = money2(p.cost);
  let costFixed = 0;
  if (recipe.length || packaging.length || costItems.length) {
    const ings = await loadIngredients(supabase, [...recipe, ...packaging].map((l) => l.ingredient_id));
    const parts = costParts(unit, recipeCost(recipe, ings, recipeYield).perUnit, linesCost(packaging, ings), costItems);
    cost = money2(parts.cost);
    costFixed = money2(parts.fixed);
  }
  const marginMode: MarginMode = p.margin_mode === "margin" ? "margin" : "markup";
  const marginPct = Math.min(marginMode === "margin" ? 95 : 1000, Math.max(0, Math.round(Number(p.margin_pct) * 100) / 100 || 0));
  const rounding = [0, 0.1, 0.5, 1].includes(Number(p.price_rounding)) ? Number(p.price_rounding) : 0;
  const priceAuto = !!p.price_auto && cost > 0;
  const row = {
    name: p.name.trim().slice(0, 80),
    category: categories.includes(p.category) ? p.category : "outros",
    description: p.description.trim() || null,
    price: priceAuto ? calcPrice(cost, marginPct, marginMode, rounding) : money2(p.price),
    cost,
    cost_items: costItems,
    recipe,
    recipe_yield: recipeYield,
    packaging,
    cost_fixed: costFixed,
    margin_pct: marginPct,
    margin_mode: marginMode,
    price_auto: priceAuto,
    price_rounding: rounding,
    unit,
    price_is_from: !!p.price_is_from,
    is_active: !!p.is_active,
    stock_enabled: !!p.stock_enabled,
    stock_qty: Math.max(0, Number(p.stock_qty) || 0),
    stock_min: Math.max(0, Number(p.stock_min) || 0),
    sort_order: Math.trunc(Number(p.sort_order) || 0),
    option_groups: cleanGroups(p.option_groups),
  };
  if (!row.name) return { error: "Informe o nome do produto." };
  const q = p.id
    ? supabase.from("products").update(row).eq("id", p.id).select("id").single()
    : supabase.from("products").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: "Não foi possível salvar o produto." };
  refreshAll();
  return { ok: true, id: data.id as string };
}

export async function adjustStock(id: string, delta: number): Promise<Result> {
  const { supabase } = await requireStaff();
  const { data: p } = await supabase.from("products").select("stock_qty").eq("id", id).single();
  if (!p) return { error: "Produto não encontrado." };
  const next = Math.max(0, Math.round((Number(p.stock_qty) + delta) * 100) / 100);
  const { error } = await supabase.from("products").update({ stock_qty: next }).eq("id", id);
  if (error) return { error: "Não foi possível atualizar o estoque." };
  refreshAll();
  return { ok: true };
}

export async function setStock(id: string, qty: number): Promise<Result> {
  const { supabase } = await requireStaff();
  const next = Math.max(0, Math.round(Number(qty) * 100) / 100 || 0);
  const { error } = await supabase.from("products").update({ stock_qty: next }).eq("id", id);
  if (error) return { error: "Não foi possível atualizar o estoque." };
  refreshAll();
  return { ok: true };
}

export async function setProductActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", id);
  if (error) return { error: "Erro ao atualizar." };
  refreshAll();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o produto." };
  refreshAll();
  return { ok: true };
}

// ======================= Ingredientes e receitas =======================
type Supa = Awaited<ReturnType<typeof requireStaff>>["supabase"];

function cleanRecipe(r: RecipeLine[] | undefined): RecipeLine[] {
  return (r ?? [])
    .filter((l) => l && typeof l.ingredient_id === "string" && /^[0-9a-f-]{36}$/i.test(l.ingredient_id))
    .map((l) => ({
      ingredient_id: l.ingredient_id,
      qty: Math.max(0, Math.round(Number(l.qty) * 1000) / 1000 || 0),
      unit: (isUnit(l.unit) ? l.unit : "g") as IngredientUnit,
    }))
    .filter((l) => l.qty > 0)
    .slice(0, 60);
}

/** Filtro jsonb "a receita contém este ingrediente". Precisa ir como texto JSON: array vira array do Postgres no supabase-js. */
const usesIngredient = (id: string) => JSON.stringify([{ ingredient_id: id }]);

async function loadIngredients(supabase: Supa, ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase.from("ingredients").select("*").in("id", [...new Set(ids)]);
  return (data ?? []).map(normalizeIngredient);
}

/** Produtos que usam o item na receita ou nas embalagens. */
async function productsUsing(supabase: Supa, ingredientId: string) {
  const [a, b] = await Promise.all([
    supabase.from("products").select("*").contains("recipe", usesIngredient(ingredientId)),
    supabase.from("products").select("*").contains("packaging", usesIngredient(ingredientId)),
  ]);
  const map = new Map<string, ReturnType<typeof normalizeProduct>>();
  for (const row of [...(a.data ?? []), ...(b.data ?? [])]) map.set(String(row.id), normalizeProduct(row));
  return [...map.values()];
}

/** Sabores (itens das listas) cuja receita usa o ingrediente. */
async function flavorsUsing(supabase: Supa, ingredientId: string) {
  const { data } = await supabase
    .from("option_items")
    .select("id, name, recipe, recipe_yield, cost")
    .contains("recipe", usesIngredient(ingredientId));
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    recipe: normalizeRecipe(r.recipe),
    recipe_yield: Number(r.recipe_yield) > 0 ? Number(r.recipe_yield) : 1,
    cost: Number(r.cost) || 0,
  }));
}

const cost4 = (v: number) => Math.max(0, Math.round(v * 10000) / 10000 || 0);

/** Recalcula custo (e preço, se automático) dos produtos e o custo dos sabores que usam o ingrediente. Devolve quantos mudaram. */
async function recalcProductsUsing(supabase: Supa, ingredientId: string) {
  const [products, flavors] = await Promise.all([productsUsing(supabase, ingredientId), flavorsUsing(supabase, ingredientId)]);
  if (!products.length && !flavors.length) return 0;
  const ings = await loadIngredients(supabase, [
    ...products.flatMap((p) => [...p.recipe, ...p.packaging].map((l) => l.ingredient_id)),
    ...flavors.flatMap((f) => f.recipe.map((l) => l.ingredient_id)),
  ]);
  let changed = 0;
  for (const p of products) {
    const parts = costParts(p.unit, recipeCost(p.recipe, ings, p.recipe_yield).perUnit, linesCost(p.packaging, ings), p.cost_items);
    const cost = money2(parts.cost);
    const costFixed = money2(parts.fixed);
    const price = p.price_auto && cost > 0 ? calcPrice(cost, p.margin_pct, p.margin_mode, p.price_rounding) : p.price;
    if (cost === p.cost && price === p.price && costFixed === p.cost_fixed) continue;
    const { error } = await supabase.from("products").update({ cost, price, cost_fixed: costFixed }).eq("id", p.id);
    if (!error) changed++;
  }
  for (const f of flavors) {
    const cost = cost4(recipeCost(f.recipe, ings, f.recipe_yield).perUnit);
    if (cost === f.cost) continue;
    const { error } = await supabase.from("option_items").update({ cost }).eq("id", f.id);
    if (!error) changed++;
  }
  return changed;
}

export type IngredientPayload = {
  id?: string;
  name: string;
  kind: IngredientKind;
  unit: IngredientUnit;
  package_qty: number;
  package_price: number;
  notes: string;
};

export async function saveIngredient(p: IngredientPayload): Promise<Result & { updated?: number }> {
  const { supabase } = await requireStaff();
  const row = {
    name: p.name.trim().slice(0, 80),
    kind: (["ingrediente", "embalagem", "outro"] as const).includes(p.kind) ? p.kind : "ingrediente",
    unit: isUnit(p.unit) ? p.unit : "g",
    package_qty: Math.round(Number(p.package_qty) * 1000) / 1000 || 0,
    package_price: money2(p.package_price),
    notes: p.notes?.trim().slice(0, 200) || null,
  };
  if (!row.name) return { error: "Informe o nome do ingrediente." };
  if (!(row.package_qty > 0)) return { error: "Informe quanto vem na embalagem." };
  if (!(row.package_price > 0)) return { error: "Informe o preço pago." };

  if (p.id) {
    // não deixa trocar peso por volume se o ingrediente já está em alguma receita
    const { data: old } = await supabase.from("ingredients").select("unit").eq("id", p.id).maybeSingle();
    if (old && unitInfo(String(old.unit)).base !== unitInfo(row.unit).base) {
      if ((await productsUsing(supabase, p.id)).length || (await flavorsUsing(supabase, p.id)).length) return { error: "Esse ingrediente já está em receitas. Mantenha o mesmo tipo de medida (peso, volume ou unidade)." };
    }
  }

  const q = p.id
    ? supabase.from("ingredients").update(row).eq("id", p.id).select("id").single()
    : supabase.from("ingredients").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: "Não foi possível salvar o ingrediente." };
  const updated = p.id ? await recalcProductsUsing(supabase, p.id) : 0;
  refreshAll();
  return { ok: true, id: data.id as string, updated };
}

export async function deleteIngredient(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const used = [...(await productsUsing(supabase, id)), ...(await flavorsUsing(supabase, id))];
  if (used.length) {
    return { error: `Esse item está em: ${used.slice(0, 5).map((u) => u.name).join(", ")}. Tire dos produtos antes de excluir.` };
  }
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o ingrediente." };
  refreshAll();
  return { ok: true };
}

// ======================= Vendas rápidas (balcão) =======================
export type QuickSalePayload = {
  date: string; // AAAA-MM-DD
  payment_method: PaymentMethod;
  discount: number;
  customer_name: string;
  items: { product_id: string; quantity: number }[];
};

export async function saveQuickSale(p: QuickSalePayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const qtys = new Map<string, number>();
  for (const i of p.items ?? []) {
    const q = Math.round(Number(i.quantity) * 100) / 100;
    if (i.product_id && q > 0) qtys.set(i.product_id, (qtys.get(i.product_id) ?? 0) + q);
  }
  if (!qtys.size) return { error: "Adicione pelo menos um produto." };
  const { data: products, error: pe } = await supabase
    .from("products")
    .select("id, name, unit, price")
    .in("id", [...qtys.keys()]);
  if (pe || !products?.length) return { error: "Produtos não encontrados." };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date <= today ? p.date : today;
  const dueAt = date === today ? new Date().toISOString() : new Date(`${date}T12:00:00-03:00`).toISOString();
  const methods: PaymentMethod[] = ["pix", "cartao", "dinheiro", "outro"];

  const order = {
    walk_in: true,
    customer_name: p.customer_name?.trim().slice(0, 120) || "Venda no balcão",
    status: "entregue",
    delivery_type: "retirada",
    due_at: dueAt,
    payment_method: methods.includes(p.payment_method) ? p.payment_method : "pix",
    discount: money2(p.discount),
    delivery_fee: 0,
    amount_paid: 0,
    notes: "",
  };
  const items = (products as { id: string; name: string; unit: string; price: unknown }[]).map((pr) => ({
    product_id: pr.id,
    product_name: pr.name,
    unit: pr.unit,
    unit_price: Number(pr.price),
    quantity: qtys.get(pr.id),
    options: {},
    note: null,
  }));
  const { data, error } = await supabase.rpc("save_order", { p_order: order, p_items: items });
  if (error) return { error: dbError(error, "Não foi possível registrar a venda.") };
  refreshAll();
  return { ok: true, id: data as string };
}

// ======================= Despesas =======================
export type ExpensePayload = { id?: string; spent_on: string; description: string; category: ExpenseCategory; amount: number };

export async function saveExpense(p: ExpensePayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const row = {
    spent_on: /^\d{4}-\d{2}-\d{2}$/.test(p.spent_on) ? p.spent_on : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    description: p.description.trim().slice(0, 120),
    category: EXPENSE_CATEGORIES.some((c) => c.id === p.category) ? p.category : "outros",
    amount: money2(p.amount),
  };
  if (!row.description) return { error: "Descreva a despesa." };
  if (!(row.amount > 0)) return { error: "Informe o valor." };
  const q = p.id
    ? supabase.from("expenses").update(row).eq("id", p.id).select("id").single()
    : supabase.from("expenses").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: "Não foi possível salvar a despesa." };
  refreshAll();
  return { ok: true, id: data.id as string };
}

export async function deleteExpense(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a despesa." };
  refreshAll();
  return { ok: true };
}

// ======================= Sabores / listas de opções =======================
export async function createOptionList(name: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const n = name.trim().slice(0, 60);
  if (!n) return { error: "Dê um nome para a lista." };
  const { data, error } = await supabase.from("option_lists").insert({ name: n, sort_order: 999 }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Já existe uma lista com esse nome." : "Erro ao criar lista." };
  refreshAll();
  return { ok: true, id: data.id as string };
}

export async function renameOptionList(id: string, name: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const n = name.trim().slice(0, 60);
  if (!n) return { error: "Nome vazio." };
  const { error } = await supabase.from("option_lists").update({ name: n }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Já existe uma lista com esse nome." : "Erro ao renomear." };
  refreshAll();
  return { ok: true };
}

export async function deleteOptionList(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("option_lists").delete().eq("id", id);
  if (error) return { error: "Erro ao excluir lista." };
  // tira a escolha dos produtos que usavam essa lista
  const { data: products } = await supabase.from("products").select("id, option_groups");
  for (const p of products ?? []) {
    const groups = (Array.isArray(p.option_groups) ? p.option_groups : []) as OptionGroup[];
    if (groups.some((g) => g.list_id === id || g.list_ids?.includes(id))) {
      const next = groups
        .map((g) => {
          if (g.kind !== "layers") return g;
          const ids = (g.list_ids ?? [g.list_id]).filter((x) => x !== id);
          return ids.length ? { ...g, list_ids: ids, list_id: ids[0] } : null;
        })
        .filter((g): g is OptionGroup => !!g && (g.kind === "layers" || g.list_id !== id));
      await supabase.from("products").update({ option_groups: next }).eq("id", p.id);
    }
  }
  refreshAll();
  return { ok: true };
}

export async function setListPrice(id: string, price: number | null): Promise<Result> {
  const { supabase } = await requireStaff();
  const v = price === null || !(Number(price) > 0) ? null : money2(price);
  const { error } = await supabase.from("option_lists").update({ price_per_kg: v }).eq("id", id);
  if (error) return { error: "Não foi possível salvar o preço." };
  refreshAll();
  return { ok: true };
}

export async function addOptionItem(listId: string, name: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const n = name.trim().slice(0, 80);
  if (!n) return { error: "Digite o nome." };
  const { data: last } = await supabase
    .from("option_items")
    .select("sort_order")
    .eq("list_id", listId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("option_items")
    .insert({ list_id: listId, name: n, sort_order: (Number(last?.sort_order) || 0) + 1 });
  if (error) return { error: error.code === "23505" ? "Esse item já está na lista." : "Erro ao adicionar." };
  refreshAll();
  return { ok: true };
}

/** Receita do sabor: ingredientes + para quantos kg (ou unidades) do produto ela dá. */
export async function saveFlavorRecipe(id: string, recipe: RecipeLine[], recipeYield: number): Promise<Result & { cost?: number }> {
  const { supabase } = await requireStaff();
  if (!isId(id)) return { error: "Sabor inválido." };
  const lines = cleanRecipe(recipe);
  const y = Math.round(Number(recipeYield) * 1000) / 1000 > 0 ? Math.round(Number(recipeYield) * 1000) / 1000 : 1;
  const ings = await loadIngredients(supabase, lines.map((l) => l.ingredient_id));
  const cost = cost4(recipeCost(lines, ings, y).perUnit);
  const { error } = await supabase.from("option_items").update({ recipe: lines, recipe_yield: y, cost }).eq("id", id);
  if (error) return { error: "Não foi possível salvar o custo do sabor." };
  refreshAll();
  return { ok: true, cost };
}

export async function setOptionItemActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("option_items").update({ is_active: active }).eq("id", id);
  if (error) return { error: "Erro ao atualizar." };
  refreshAll();
  return { ok: true };
}

export async function deleteOptionItem(id: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("option_items").delete().eq("id", id);
  if (error) return { error: "Erro ao excluir." };
  refreshAll();
  return { ok: true };
}

// ======================= Equipe / conta =======================
export async function addAllowedEmail(email: string): Promise<Result> {
  const { supabase } = await requireStaff();
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: "E-mail inválido." };
  const { error } = await supabase.from("allowed_emails").insert({ email: e });
  if (error) return { error: error.code === "23505" ? "Esse e-mail já tem acesso." : "Erro ao adicionar." };
  refreshAll();
  return { ok: true };
}

export async function removeAllowedEmail(email: string): Promise<Result> {
  const { supabase, user } = await requireStaff();
  if (email.toLowerCase() === user.email?.toLowerCase()) return { error: "Você não pode remover o seu próprio acesso." };
  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  if (error) return { error: "Erro ao remover." };
  refreshAll();
  return { ok: true };
}

export async function changePassword(password: string): Promise<Result> {
  const { supabase } = await requireStaff();
  if (typeof password !== "string" || password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password.length > 72) return { error: "Senha longa demais (máximo 72 caracteres)." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("different from the old")) return { error: "A nova senha precisa ser diferente da atual." };
    if (m.includes("weak") || m.includes("short")) return { error: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." };
    if (m.includes("reauthentication")) return { error: "Por segurança, saia e entre de novo antes de trocar a senha." };
    return { error: "Não foi possível trocar a senha. Tente novamente." };
  }
  return { ok: true };
}

export async function updateMyName(name: string): Promise<Result> {
  const { supabase, user } = await requireStaff();
  const n = name.trim().slice(0, 60);
  const { error } = await supabase.from("profiles").update({ full_name: n || null }).eq("id", user.id);
  if (error) return { error: "Erro ao salvar." };
  refreshAll();
  return { ok: true };
}
