import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { dayKey, relativeDay } from "@/lib/format";
import { ButtonLink, Card, EmptyState, PageHeader, cn, inputClass } from "@/components/ui";
import OrderCard from "@/components/OrderCard";

export const metadata = { title: "Pedidos" };

const TABS = [
  { id: "abertos", label: "Em aberto" },
  { id: "entregues", label: "Entregues" },
  { id: "cancelados", label: "Cancelados" },
  { id: "todos", label: "Todos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.aba)?.id ?? "abertos") as Tab;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const { supabase } = await requireStaff();

  let query = supabase.from("orders").select("*, order_items(product_name, quantity, unit)").limit(300);
  if (tab === "abertos") query = query.in("status", ["novo", "confirmado", "em_preparo", "pronto"]);
  if (tab === "entregues") query = query.eq("status", "entregue");
  if (tab === "cancelados") query = query.eq("status", "cancelado");
  if (q) query = /^#?\d+$/.test(q) ? query.eq("code", Number(q.replace("#", ""))) : query.ilike("customer_name", `%${q}%`);
  query = query.order("due_at", { ascending: tab === "abertos", nullsFirst: false }).order("created_at", { ascending: false });

  const { data } = await query;
  const orders = (data ?? []) as Order[];

  // Agrupa por dia de entrega
  const groups: { key: string; label: string; list: Order[] }[] = [];
  for (const o of orders) {
    const key = o.due_at ? dayKey(o.due_at) : "sem-data";
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: o.due_at ? relativeDay(o.due_at) : "Sem data", list: [] };
      groups.push(g);
    }
    g.list.push(o);
  }

  const href = (t: Tab) => `/pedidos?aba=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle={`${orders.length} pedido(s)`}
        actions={
          <ButtonLink href="/pedidos/novo" variant="primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo pedido
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={href(t.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
                tab === t.id ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative lg:w-72" action="/pedidos">
          <input type="hidden" name="aba" value={tab} />
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input name="q" defaultValue={q} placeholder="Buscar cliente ou nº do pedido" className={cn(inputClass, "pl-9")} />
        </form>
      </div>

      <Card className="overflow-hidden">
        {orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={q ? "Nada encontrado" : "Nenhum pedido aqui"}
            text={q ? "Tente outro nome ou número." : "Os pedidos cadastrados aparecem nesta lista."}
          />
        ) : (
          <>
            <div className="hidden border-b border-line bg-bg/60 px-5 py-2 text-xs font-semibold text-ink-3 lg:flex lg:gap-5">
              <span className="w-16">Horário</span>
              <span className="flex-1">Cliente e itens</span>
              <span className="w-28">Status</span>
              <span className="w-28 text-right">Total</span>
              <span className="w-40" />
            </div>
            {groups.map((g) => (
              <section key={g.key}>
                <div className="border-b border-line bg-bg/60 px-4 py-2 text-xs font-bold tracking-wide text-ink-3 uppercase lg:px-5">
                  {g.label}
                </div>
                <div className="divide-y divide-line border-b border-line last:border-b-0">
                  {g.list.map((o) => (
                    <OrderCard key={o.id} order={o} showDate={false} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </Card>
    </>
  );
}
