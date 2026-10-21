"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, Search } from "lucide-react";
import type { PaymentMethod, Product } from "@/lib/types";
import { CATEGORIES, PAYMENT_METHODS } from "@/lib/types";
import { brl, parseNum, qty } from "@/lib/format";
import { saveQuickSale } from "../../actions";
import { Button, Card, ErrorNote, Field, Input, Segmented, cn, inputClass } from "@/components/ui";

const todaySP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export default function QuickSale({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [discount, setDiscount] = useState("");
  const [customer, setCustomer] = useState("");
  const [date, setDate] = useState(todaySP());

  // produtos com escolhas obrigatórias (massa, recheio…) vão pelo pedido completo
  const sellable = products.filter((p) => !p.option_groups.some((g) => g.required));
  const withOptions = products.length - sellable.length;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return sellable.filter((p) => !t || p.name.toLowerCase().includes(t));
  }, [q, sellable]);

  const lines = Object.entries(cart)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ p: products.find((x) => x.id === id)!, n }))
    .filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + Math.round(l.p.price * l.n * 100) / 100, 0);
  const cost = lines.reduce((s, l) => s + l.p.cost * l.n, 0);
  const disc = Math.min(parseNum(discount), subtotal);
  const total = Math.max(0, subtotal - disc);
  const profit = total - cost;

  const step = (p: Product) => (p.unit === "kg" ? 0.5 : 1);
  const change = (p: Product, d: number) =>
    setCart((c) => {
      let n = Math.max(0, Math.round(((c[p.id] ?? 0) + d) * 100) / 100);
      if (p.stock_enabled) n = Math.min(n, p.stock_qty);
      return { ...c, [p.id]: n };
    });

  const submit = () => {
    setError("");
    start(async () => {
      const r = await saveQuickSale({
        date,
        payment_method: payment,
        discount: disc,
        customer_name: customer,
        items: lines.map((l) => ({ product_id: l.p.id, quantity: l.n })),
      });
      if (r.error) return setError(r.error);
      setDone(brl(total));
      setCart({});
      setDiscount("");
      setCustomer("");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:gap-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input className={cn(inputClass, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
        </div>

        {CATEGORIES.map((c) => {
          const items = list.filter((p) => p.category === c.id);
          if (!items.length) return null;
          return (
            <section key={c.id}>
              <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-ink-3 uppercase">{c.label}</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {items.map((p) => {
                  const n = cart[p.id] ?? 0;
                  const out = p.stock_enabled && p.stock_qty <= 0;
                  const atMax = p.stock_enabled && n >= p.stock_qty;
                  return (
                    <Card key={p.id} className={cn("flex items-center gap-3 p-3 transition", n > 0 && "ring-2 ring-brand", out && "opacity-55")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold">{p.name}</p>
                        <p className="num text-xs text-ink-3">
                          {brl(p.price)}
                          {p.unit === "kg" ? "/kg" : ""}
                          {p.stock_enabled && <span className={cn(p.stock_qty <= p.stock_min && "font-semibold text-red-600")}> · {out ? "esgotado" : `${qty(p.stock_qty, p.unit)} prontos`}</span>}
                        </p>
                      </div>
                      <div className="inline-flex shrink-0 items-center rounded-xl border border-line bg-surface">
                        <button type="button" onClick={() => change(p, -step(p))} disabled={!n} className="flex h-10 w-10 items-center justify-center rounded-l-xl text-ink-2 disabled:opacity-30" aria-label={`Tirar ${p.name}`}>
                          <Minus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <span className="num min-w-8 text-center font-bold">{n.toLocaleString("pt-BR")}</span>
                        <button type="button" onClick={() => change(p, step(p))} disabled={out || atMax} className="flex h-10 w-10 items-center justify-center rounded-r-xl text-brand disabled:opacity-30" aria-label={`Adicionar ${p.name}`}>
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
        {list.length === 0 && <p className="px-1 py-6 text-center text-sm text-ink-3">Nenhum produto encontrado.</p>}
        {withOptions > 0 && (
          <p className="px-1 text-[13px] text-ink-3">
            {withOptions} produto(s) com sabores para escolher ficam no{" "}
            <Link href="/pedidos/novo" className="font-semibold text-brand">
              pedido completo
            </Link>
            .
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-9 lg:self-start">
        <Card className="space-y-4 p-4 lg:p-5">
          <h2 className="font-display text-lg font-semibold">Resumo</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-ink-3">Toque em + nos produtos para montar a venda.</p>
          ) : (
            <ul className="num space-y-1.5 text-[13.5px]">
              {lines.map((l) => (
                <li key={l.p.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {l.n.toLocaleString("pt-BR")}× {l.p.name}
                  </span>
                  <span className="shrink-0">{brl(l.p.price * l.n)}</span>
                </li>
              ))}
            </ul>
          )}

          <Field label="Pagamento">
            <Segmented value={payment} onChange={setPayment} options={PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))} className="text-[13px]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desconto (R$)">
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Data">
              <Input type="date" value={date} max={todaySP()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Cliente (opcional)">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Venda no balcão" maxLength={120} />
          </Field>

          <div className="num space-y-1 border-t border-line pt-3 text-[13.5px]">
            {disc > 0 && (
              <p className="flex justify-between text-ink-3">
                <span>Desconto</span>
                <span>−{brl(disc)}</span>
              </p>
            )}
            <p className="flex justify-between text-ink-3">
              <span>Custo de produção</span>
              <span>{brl(cost)}</span>
            </p>
            <p className="font-display flex justify-between pt-1 text-xl font-bold">
              <span>Total</span>
              <span>{brl(total)}</span>
            </p>
            <p className={cn("flex justify-between font-semibold", profit >= 0 ? "text-emerald-700" : "text-red-600")}>
              <span>Lucro desta venda</span>
              <span>{brl(profit)}</span>
            </p>
          </div>

          <ErrorNote>{error}</ErrorNote>
          {done && !lines.length && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">
              <Check className="h-4 w-4" /> Venda de {done} registrada.
            </p>
          )}
          <Button variant="primary" size="lg" className="w-full" disabled={pending || !lines.length} onClick={submit}>
            {pending ? "Registrando…" : `Registrar venda${lines.length ? ` · ${brl(total)}` : ""}`}
          </Button>
        </Card>
      </div>
    </div>
  );
}
