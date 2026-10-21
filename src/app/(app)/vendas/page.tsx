import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt, ShoppingBag, Store, TrendingUp, Wallet, Zap } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import { brl, formatDate, PAYMENT_LABEL } from "@/lib/format";
import { pctFmt } from "@/lib/pricing";
import { buildPeriods, loadExpenses, loadSales, topProducts, totals, type Mode } from "@/lib/report";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, cn } from "@/components/ui";
import { ChartLegend, GroupedBars } from "@/components/Charts";
import ExpenseDialog, { ExpenseRow } from "./ExpenseDialog";

export const metadata = { title: "Vendas e lucro" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ modo?: string; p?: string }> }) {
  const sp = await searchParams;
  const mode: Mode = sp.modo === "mensal" ? "mensal" : "semanal";
  const periods = buildPeriods(mode);
  const sel = Math.min(periods.length - 1, Math.max(0, Number.isFinite(Number(sp.p)) && sp.p !== undefined ? Number(sp.p) : periods.length - 1));
  const { supabase } = await requireStaff();

  const first = periods[0].from;
  const last = periods[periods.length - 1].to;
  const [sales, expenses] = await Promise.all([loadSales(supabase, first, last), loadExpenses(supabase, first, last)]);

  const rows = periods.map((p, i) => ({ ...p, ...totals(sales, expenses, p.from, p.to), href: `/vendas?modo=${mode}&p=${i}` }));
  const cur = rows[sel];
  const prev = rows[sel - 1];
  const tops = topProducts(sales, cur.from, cur.to).slice(0, 6);
  const maxProfit = Math.max(1, ...tops.map((t) => Math.abs(t.profit)));
  const periodSales = sales.filter((s) => s.day >= cur.from && s.day <= cur.to).sort((a, b) => b.when.localeCompare(a.when));
  const periodExpenses = expenses.filter((e) => e.spent_on >= cur.from && e.spent_on <= cur.to);
  const base = Math.max(cur.bruto, cur.gastos) || 1;
  const wCusto = (cur.custo / base) * 100;
  const wDesp = (cur.despesas / base) * 100;
  const wLucro = Math.max(0, (cur.lucro / base) * 100);
  const delta = prev && prev.lucro !== 0 ? ((cur.lucro - prev.lucro) / Math.abs(prev.lucro)) * 100 : null;
  const noCost = periodSales.some((s) => s.items.some((i) => i.cost === 0 && i.product_id));

  const href = (m: Mode, p?: number) => `/vendas?modo=${m}${p !== undefined ? `&p=${p}` : ""}`;
  const title = mode === "semanal" ? `Semana de ${cur.long}` : cap(cur.long);

  return (
    <>
      <PageHeader
        title="Vendas e lucro"
        subtitle="Quanto entrou, quanto saiu e quanto sobrou"
        actions={
          <>
            <ExpenseDialog />
            <ButtonLink href="/vendas/rapida" variant="primary">
              <Zap className="h-4 w-4" strokeWidth={2.4} /> Venda rápida
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4 inline-flex w-full rounded-xl border border-line bg-surface p-1 sm:w-auto">
        {(["semanal", "mensal"] as Mode[]).map((m) => (
          <Link
            key={m}
            href={href(m)}
            scroll={false}
            className={cn(
              "flex-1 rounded-lg px-5 py-2 text-center text-sm font-semibold transition sm:flex-none",
              mode === m ? "bg-ink text-white shadow-sm" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {m === "semanal" ? "Semanal" : "Mensal"}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6">
        {/* Resumo do período */}
        <section className="hero-card relative overflow-hidden rounded-3xl p-5 text-white lg:p-6">
          <div className="relative flex items-center gap-2">
            <Link
              href={href(mode, Math.max(0, sel - 1))}
              scroll={false}
              aria-label="Período anterior"
              className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 transition hover:bg-white/20", sel === 0 && "pointer-events-none opacity-30")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <p className="font-display flex-1 text-center text-[17px] font-semibold">{title}</p>
            <Link
              href={href(mode, Math.min(rows.length - 1, sel + 1))}
              scroll={false}
              aria-label="Próximo período"
              className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 transition hover:bg-white/20", sel === rows.length - 1 && "pointer-events-none opacity-30")}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mt-5">
            <p className="text-xs font-semibold tracking-[0.08em] text-white/70 uppercase">Lucro final</p>
            <p className={cn("num font-display mt-1 text-[40px] leading-none font-bold", cur.lucro < 0 && "text-red-200")}>{brl(cur.lucro)}</p>
            <p className="mt-2 text-[13px] text-white/75">
              Margem real de <b className="text-white">{pctFmt(cur.margem)}</b>
              {delta !== null && (
                <>
                  {" · "}
                  <span className={delta >= 0 ? "text-emerald-200" : "text-red-200"}>
                    {delta >= 0 ? "▲" : "▼"} {pctFmt(Math.abs(delta))}
                  </span>{" "}
                  vs. {mode === "semanal" ? "semana anterior" : "mês anterior"}
                </>
              )}
            </p>
          </div>

          <div className="num relative mt-5 grid grid-cols-2 gap-2.5">
            {[
              { l: "Rendimento bruto", v: brl(cur.bruto), c: "var(--color-s-bruto-light)" },
              { l: "Gastos totais", v: brl(cur.gastos), c: "var(--color-s-gasto-light)" },
              { l: "Vendas", v: String(cur.vendas) },
              { l: "Ticket médio", v: brl(cur.ticket) },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl bg-white/10 p-3">
                <p className="flex items-center gap-1.5 text-[12px] text-white/70">
                  {k.c && <i className="h-2 w-2 rounded-[2px]" style={{ background: k.c }} />}
                  {k.l}
                </p>
                <p className="mt-0.5 text-[17px] font-bold">{k.v}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-5">
            <p className="mb-2 text-[12.5px] font-semibold text-white/80">Para onde foi o dinheiro</p>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/10">
              {wCusto > 0 && <i style={{ width: `${wCusto}%`, background: "var(--color-s-gasto-light)" }} />}
              {wDesp > 0 && <i style={{ width: `${wDesp}%`, background: "var(--color-s-gasto-light)", opacity: 0.55 }} />}
              {wLucro > 0 && <i style={{ width: `${wLucro}%`, background: "var(--color-s-lucro-light)" }} />}
            </div>
            <div className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/75">
              <span>Custo dos produtos {brl(cur.custo)}</span>
              <span>Despesas {brl(cur.despesas)}</span>
            </div>
          </div>
        </section>

        {/* Gráfico */}
        <Card className="min-w-0 p-4 lg:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{mode === "semanal" ? "Últimas 8 semanas" : "Últimos 6 meses"}</h2>
            <ChartLegend />
          </div>
          <GroupedBars data={rows.map((r) => ({ label: cap(r.label), long: mode === "semanal" ? `Semana ${r.long}` : cap(r.long), bruto: r.bruto, gastos: r.gastos, lucro: r.lucro, href: r.href }))} selected={sel} />
          <details className="group mt-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-brand select-none">Ver em tabela</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="py-2 pr-3 font-semibold">{mode === "semanal" ? "Semana" : "Mês"}</th>
                    <th className="py-2 pr-3 text-right font-semibold">Bruto</th>
                    <th className="py-2 pr-3 text-right font-semibold">Gastos</th>
                    <th className="py-2 pr-3 text-right font-semibold">Lucro</th>
                    <th className="py-2 text-right font-semibold">Vendas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.from} className={cn("border-t border-line", i === sel && "bg-brand-soft/60")}>
                      <td className="py-2 pr-3 whitespace-nowrap">{mode === "semanal" ? r.long : cap(r.label)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{brl(r.bruto)}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{brl(r.gastos)}</td>
                      <td className={cn("py-2 pr-3 text-right font-semibold whitespace-nowrap", r.lucro < 0 && "text-red-600")}>{brl(r.lucro)}</td>
                      <td className="py-2 text-right">{r.vendas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      </div>

      {noCost && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
          Alguns produtos vendidos neste período estão sem custo cadastrado, então o lucro aparece maior do que é. Informe o custo em{" "}
          <Link href="/produtos?filtro=sem-custo" className="font-semibold underline">
            Produtos
          </Link>
          .
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:gap-6">
        <Card className="overflow-hidden">
          <CardHeader title="Produtos que mais lucraram" subtitle={title} />
          {tops.length === 0 ? (
            <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Sem vendas neste período" />
          ) : (
            <ul className="divide-y divide-line">
              {tops.map((t) => (
                <li key={t.name} className="flex items-center gap-4 px-4 py-3 lg:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{t.name}</p>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
                      <i className="block h-full rounded-full" style={{ width: `${Math.max(3, (Math.abs(t.profit) / maxProfit) * 100)}%`, background: "var(--color-s-lucro)" }} />
                    </div>
                  </div>
                  <div className="num shrink-0 text-right">
                    <p className="text-[13.5px] font-bold">{brl(t.profit)}</p>
                    <p className="text-xs text-ink-3">
                      {t.qty.toLocaleString("pt-BR")} {t.unit} · {brl(t.revenue)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Despesas do período" subtitle={`${brl(cur.despesas)} · gás, embalagens, entregas…`} action={<ExpenseDialog compact />} />
          {periodExpenses.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="Nenhuma despesa lançada" text="Lance aqui o que não entra no custo de cada produto." />
          ) : (
            <ul className="divide-y divide-line">
              {periodExpenses.map((e) => (
                <ExpenseRow key={e.id} expense={e} label={EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.label ?? "Outros"} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Vendas do período" subtitle={`${periodSales.length} venda(s) · ${brl(cur.bruto)}`} />
        {periodSales.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="Nenhuma venda neste período"
            text="Pedidos entram aqui pela data de entrega. Vendas no balcão entram na hora."
            action={
              <ButtonLink href="/vendas/rapida" variant="primary" size="sm">
                <Zap className="h-4 w-4" /> Venda rápida
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {periodSales.slice(0, 60).map((s) => (
              <li key={s.id}>
                <Link href={`/pedidos/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg/70 lg:px-5">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", s.sale_channel === "balcao" ? "bg-amber-50 text-amber-700" : "bg-brand-soft text-brand-dark")}>
                    {s.sale_channel === "balcao" ? <Store className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">
                      {s.customer_name} <span className="num font-normal text-ink-3">#{s.code}</span>
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      {formatDate(s.when, { weekday: "short", day: "2-digit", month: "2-digit" })}
                      {s.payment_method ? ` · ${PAYMENT_LABEL[s.payment_method]}` : ""} · {s.items.map((i) => i.product_name).join(", ")}
                    </p>
                  </div>
                  <div className="num shrink-0 text-right">
                    <p className="text-[13.5px] font-bold">{brl(s.total)}</p>
                    <p className={cn("text-xs font-semibold", s.total - s.cost >= 0 ? "text-emerald-700" : "text-red-600")}>lucro {brl(s.total - s.cost)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-ink-3">
        Gastos = custo de produção dos itens vendidos + despesas lançadas. Lucro final = rendimento bruto − gastos. Pedidos cancelados não entram.
      </p>
    </>
  );
}
