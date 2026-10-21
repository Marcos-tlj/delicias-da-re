"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireStaff } from "@/lib/supabase/server";
import type { Category, CostItem, ExpenseCategory, MarginMode, OptionGroup, OrderStatus, PaymentMethod, SelectedOptions, Unit } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { calcPrice } from "@/lib/pricing";

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

export async function saveOrder(p: OrderPayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const { items, ...order } = p;
  const { data, error } = await supabase.rpc("save_order", { p_order: order, p_items: items });
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
};

const money2 = (v: unknown) => Math.max(0, Math.round(Number(v) * 100) / 100 || 0);

export async function saveProduct(p: ProductPayload): Promise<Result> {
  const { supabase } = await requireStaff();
  const categories: Category[] = ["bolos", "doces", "tortas", "outros"];
  const costItems = (p.cost_items ?? [])
    .map((c) => ({ name: String(c.name ?? "").trim().slice(0, 60), value: money2(c.value) }))
    .filter((c) => c.name || c.value)
    .slice(0, 40);
  const cost = costItems.length ? money2(costItems.reduce((a, c) => a + c.value, 0)) : money2(p.cost);
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
    margin_pct: marginPct,
    margin_mode: marginMode,
    price_auto: priceAuto,
    price_rounding: rounding,
    unit: p.unit === "kg" ? "kg" : "un",
    price_is_from: !!p.price_is_from,
    is_active: !!p.is_active,
    stock_enabled: !!p.stock_enabled,
    stock_qty: Math.max(0, Number(p.stock_qty) || 0),
    stock_min: Math.max(0, Number(p.stock_min) || 0),
    sort_order: Math.trunc(Number(p.sort_order) || 0),
    option_groups: (p.option_groups ?? [])
      .filter((g) => g.list_id && g.label.trim())
      .map((g) => ({ label: g.label.trim().slice(0, 40), list_id: g.list_id, required: !!g.required, multi: !!g.multi })),
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
    if (groups.some((g) => g.list_id === id)) {
      await supabase.from("products").update({ option_groups: groups.filter((g) => g.list_id !== id) }).eq("id", p.id);
    }
  }
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

export async function updateMyName(name: string): Promise<Result> {
  const { supabase, user } = await requireStaff();
  const n = name.trim().slice(0, 60);
  const { error } = await supabase.from("profiles").update({ full_name: n || null }).eq("id", user.id);
  if (error) return { error: "Erro ao salvar." };
  refreshAll();
  return { ok: true };
}
