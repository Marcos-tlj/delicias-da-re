import "server-only";
import type { createClient } from "./supabase/server";
import type { Expense, Order, PaymentMethod } from "./types";
import { addDaysKey, dayKey, todayKey } from "./format";

type Supa = Awaited<ReturnType<typeof createClient>>;

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type Mode = "semanal" | "mensal";

export type Period = { from: string; to: string; label: string; long: string };

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

/** Segunda-feira da semana (AAAA-MM-DD, fuso de SP). */
export function weekStartKey(key: string) {
  const dow = new Date(`${key}T12:00:00-03:00`).getUTCDay(); // 0 = domingo
  return addDaysKey(key, -((dow + 6) % 7));
}

export function buildPeriods(mode: Mode): Period[] {
  const today = todayKey();
  const out: Period[] = [];
  if (mode === "semanal") {
    const ws = weekStartKey(today);
    for (let i = 7; i >= 0; i--) {
      const from = addDaysKey(ws, -7 * i);
      const to = addDaysKey(from, 6);
      out.push({ from, to, label: ddmm(from), long: `${ddmm(from)} a ${ddmm(to)}` });
    }
  } else {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7)) - 1;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - i, 1));
      const yy = d.getUTCFullYear();
      const mm = d.getUTCMonth();
      const from = `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
      const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
      const to = `${yy}-${String(mm + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      out.push({ from, to, label: MES[mm], long: `${MES_LONGO[mm]} de ${yy}` });
    }
  }
  return out;
}

export type SaleRow = {
  id: string;
  code: number;
  customer_name: string;
  status: Order["status"];
  sale_channel: "pedido" | "balcao";
  payment_method: PaymentMethod | null;
  total: number;
  cost: number;
  day: string;
  when: string;
  items: { product_id: string | null; product_name: string; quantity: number; unit: string; line_total: number; cost: number }[];
};

/** Vendas (pedidos não cancelados) cuja data de entrega — ou de criação, se não tiver — cai no intervalo. */
export async function loadSales(supabase: Supa, fromKey: string, toKey: string): Promise<SaleRow[]> {
  const a = new Date(`${fromKey}T00:00:00-03:00`).toISOString();
  const b = new Date(`${addDaysKey(toKey, 1)}T00:00:00-03:00`).toISOString();

  const [{ data: prods }, rows] = await Promise.all([
    supabase.from("products").select("id, cost"),
    (async () => {
      const all: Record<string, unknown>[] = [];
      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, code, customer_name, status, sale_channel, payment_method, total, due_at, created_at, order_items(product_id, product_name, quantity, unit, line_total, unit_cost)",
          )
          .neq("status", "cancelado")
          .or(`and(due_at.gte.${a},due_at.lt.${b}),and(due_at.is.null,created_at.gte.${a},created_at.lt.${b})`)
          .order("created_at", { ascending: true })
          .range(page * 1000, page * 1000 + 999);
        if (error || !data) break;
        all.push(...(data as Record<string, unknown>[]));
        if (data.length < 1000) break;
      }
      return all;
    })(),
  ]);

  // vendas antigas (antes do custo existir) usam o custo atual do produto como estimativa
  const currentCost = new Map<string, number>(((prods ?? []) as { id: string; cost: unknown }[]).map((p) => [p.id, Number(p.cost) || 0]));

  return rows.map((o) => {
    const when = (o.due_at as string | null) ?? (o.created_at as string);
    const items = ((o.order_items as Record<string, unknown>[]) ?? []).map((i) => {
      const q = Number(i.quantity) || 0;
      const uc: number = Number(i.unit_cost) || currentCost.get(String(i.product_id)) || 0;
      return {
        product_id: (i.product_id as string | null) ?? null,
        product_name: String(i.product_name),
        quantity: q,
        unit: String(i.unit),
        line_total: Number(i.line_total) || 0,
        cost: Math.round(uc * q * 100) / 100,
      };
    });
    return {
      id: o.id as string,
      code: Number(o.code),
      customer_name: String(o.customer_name),
      status: o.status as Order["status"],
      sale_channel: (o.sale_channel as "pedido" | "balcao") ?? "pedido",
      payment_method: (o.payment_method as PaymentMethod | null) ?? null,
      total: Number(o.total) || 0,
      cost: items.reduce((s, i) => s + i.cost, 0),
      day: dayKey(when),
      when,
      items,
    };
  });
}

export async function loadExpenses(supabase: Supa, fromKey: string, toKey: string): Promise<Expense[]> {
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .gte("spent_on", fromKey)
    .lte("spent_on", toKey)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  return (data ?? []).map((e) => ({ ...(e as Expense), amount: Number(e.amount) }));
}

export type Totals = {
  bruto: number;
  custo: number;
  despesas: number;
  gastos: number;
  lucro: number;
  margem: number;
  vendas: number;
  ticket: number;
};

export function totals(sales: SaleRow[], expenses: Expense[], from: string, to: string): Totals {
  let bruto = 0,
    custo = 0,
    vendas = 0,
    despesas = 0;
  for (const s of sales)
    if (s.day >= from && s.day <= to) {
      bruto += s.total;
      custo += s.cost;
      vendas++;
    }
  for (const e of expenses) if (e.spent_on >= from && e.spent_on <= to) despesas += e.amount;
  const gastos = custo + despesas;
  const lucro = bruto - gastos;
  return { bruto, custo, despesas, gastos, lucro, margem: bruto ? (lucro / bruto) * 100 : 0, vendas, ticket: vendas ? bruto / vendas : 0 };
}

export function topProducts(sales: SaleRow[], from: string, to: string) {
  const m = new Map<string, { name: string; qty: number; unit: string; revenue: number; cost: number }>();
  for (const s of sales) {
    if (s.day < from || s.day > to) continue;
    // desconto/taxa distribuídos proporcionalmente entre os itens
    const lines = s.items.reduce((a, i) => a + i.line_total, 0) || 1;
    for (const i of s.items) {
      const k = i.product_id ?? `nome:${i.product_name}`;
      const cur = m.get(k) ?? { name: i.product_name, qty: 0, unit: i.unit, revenue: 0, cost: 0 };
      cur.qty += i.quantity;
      cur.revenue += (i.line_total / lines) * s.total;
      cur.cost += i.cost;
      m.set(k, cur);
    }
  }
  return [...m.values()].map((x) => ({ ...x, profit: x.revenue - x.cost })).sort((a, b) => b.profit - a.profit);
}

export { todayKey, addDaysKey };
