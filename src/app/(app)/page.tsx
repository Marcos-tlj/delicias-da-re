import Link from "next/link";
import { AlertTriangle, CalendarDays, CircleDollarSign, Clock, PackageCheck, Plus, TrendingUp } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import type { Order, Product } from "@/lib/types";
import { addDaysKey, brl, dayKey, formatDate, qty, todayKey } from "@/lib/format";
import { ButtonLink, Card, CardHeader, EmptyState, cn } from "@/components/ui";
import OrderCard from "@/components/OrderCard";
import StockStepper from "@/components/StockStepper";

export const metadata = { title: "Início" };

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Dashboard() {
  const { supabase, name } = await requireStaff();
  const today = todayKey();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-03:00`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const [openRes, monthRes, unpaidRes, stockRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(product_name, quantity, unit)")
      .in("status", ["novo", "confirmado", "em_preparo", "pronto"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("orders")
      .select("total, status")
      .neq("status", "cancelado")
      .gte("due_at", monthStart.toISOString())
      .lt("due_at", nextMonth.toISOString()),
    supabase.from("orders").select("total, amount_paid").neq("status", "cancelado").neq("payment_status", "pago"),
    supabase
      .from("products")
      .select("id, name, unit, stock_qty, stock_min")
      .eq("stock_enabled", true)
      .eq("is_active", true)
      .order("name"),
  ]);

  const open = (openRes.data ?? []) as Order[];
  const month = monthRes.data ?? [];
  const unpaid = unpaidRes.data ?? [];
  const stock = (stockRes.data ?? []) as Pick<Product, "id" | "name" | "unit" | "stock_qty" | "stock_min">[];

  const tomorrow = addDaysKey(today, 1);
  const weekEnd = addDaysKey(today, 7);
  const late = open.filter((o) => o.due_at && dayKey(o.due_at) <= today && new Date(o.due_at).getTime() < Date.now());
  const lateIds = new Set(late.map((o) => o.id));
  const todayList = open.filter((o) => o.due_at && dayKey(o.due_at) === today && !lateIds.has(o.id));
  const tomorrowList = open.filter((o) => o.due_at && dayKey(o.due_at) === tomorrow);
  const nextList = open.filter((o) => o.due_at && dayKey(o.due_at) > tomorrow && dayKey(o.due_at) <= weekEnd);
  const laterList = open.filter((o) => o.due_at && dayKey(o.due_at) > weekEnd);
  const noDate = open.filter((o) => !o.due_at);

  const toReceive = unpaid.reduce((s, o) => s + (Number(o.total) - Number(o.amount_paid)), 0);
  const monthRevenue = month.reduce((s, o) => s + Number(o.total), 0);
  const lowStock = stock.filter((p) => Number(p.stock_qty) <= Number(p.stock_min));

  const stats = [
    { label: "Para hoje", value: String(todayList.length + late.length), hint: late.length ? `${late.length} atrasado(s)` : "entregas e retiradas", icon: CalendarDays, alert: late.length > 0 },
    { label: "Em aberto", value: String(open.length), hint: "pedidos não entregues", icon: Clock },
    { label: "A receber", value: brl(toReceive), hint: `${unpaid.length} pedido(s)`, icon: CircleDollarSign },
    { label: "Vendas do mês", value: brl(monthRevenue), hint: `${month.length} pedido(s) em ${formatDate(monthStart.toISOString(), { month: "long" })}`, icon: TrendingUp },
  ];

  const groups = [
    { title: "Atrasados", list: late, tone: "red" as const },
    { title: "Hoje", list: todayList },
    { title: "Amanhã", list: tomorrowList },
    { title: "Próximos 7 dias", list: nextList },
    { title: "Mais adiante", list: laterList },
    { title: "Sem data definida", list: noDate },
  ].filter((g) => g.list.length > 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 lg:mb-8">
        <div>
          <p className="text-sm font-medium text-ink-3 capitalize">
            {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">
            {greeting()}, {name.split(" ")[0]}
          </h1>
        </div>
        <ButtonLink href="/pedidos/novo" variant="primary" className="hidden lg:inline-flex">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo pedido
        </ButtonLink>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-3">{s.label}</p>
              <s.icon className={cn("h-4 w-4", s.alert ? "text-red-500" : "text-ink-3")} />
            </div>
            <p className="num mt-2 text-xl font-bold tracking-tight lg:text-2xl">{s.value}</p>
            <p className={cn("mt-0.5 truncate text-xs", s.alert ? "font-semibold text-red-600" : "text-ink-3")}>{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[1fr_320px]">
        {/* Agenda */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Agenda de entregas"
            subtitle="Pedidos em aberto por data"
            action={
              <Link href="/pedidos" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
                Ver todos
              </Link>
            }
          />
          {groups.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nenhum pedido em aberto"
              text="Quando um pedido for cadastrado, ele aparece aqui organizado pela data de entrega."
              action={
                <ButtonLink href="/pedidos/novo" variant="primary" size="sm">
                  <Plus className="h-4 w-4" /> Novo pedido
                </ButtonLink>
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.title}>
                <div
                  className={cn(
                    "flex items-center justify-between border-b border-line px-4 py-2 text-xs font-bold tracking-wide uppercase lg:px-5",
                    g.tone === "red" ? "bg-red-50/60 text-red-700" : "bg-bg/60 text-ink-3",
                  )}
                >
                  {g.title}
                  <span className="num">{g.list.length}</span>
                </div>
                <div className="divide-y divide-line border-b border-line last:border-b-0">
                  {g.list.map((o) => (
                    <OrderCard key={o.id} order={o} showDate={g.title !== "Hoje" && g.title !== "Amanhã"} />
                  ))}
                </div>
              </section>
            ))
          )}
        </Card>

        {/* Estoque */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="Prontos para venda"
              subtitle="Estoque atual"
              action={
                <Link href="/produtos?filtro=estoque" className="text-[13px] font-semibold text-brand hover:text-brand-dark">
                  Gerenciar
                </Link>
              }
            />
            {stock.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="h-5 w-5" />}
                title="Nenhum produto com estoque"
                text="Ative “Controlar estoque” em um produto para acompanhar os prontos."
              />
            ) : (
              <ul className="divide-y divide-line">
                {stock.map((p) => {
                  const low = Number(p.stock_qty) <= Number(p.stock_min);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 lg:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold">{p.name}</p>
                        <p className={cn("text-xs", low ? "font-semibold text-red-600" : "text-ink-3")}>
                          {Number(p.stock_qty) === 0 ? "Esgotado" : `${qty(p.stock_qty, p.unit)} disponível`}
                        </p>
                      </div>
                      <StockStepper id={p.id} value={Number(p.stock_qty)} unit={p.unit} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {lowStock.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <b>Estoque baixo:</b> {lowStock.map((p) => p.name).join(", ")}.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
