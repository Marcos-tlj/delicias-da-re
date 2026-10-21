"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronRight, PackageCheck } from "lucide-react";
import type { Product } from "@/lib/types";
import { brl } from "@/lib/format";
import { pctFmt, profitOf } from "@/lib/pricing";
import { setProductActive } from "../actions";
import { Pill, cn } from "@/components/ui";
import StockStepper from "@/components/StockStepper";

export default function ProductRow({ product: p }: { product: Product }) {
  const [active, setActive] = useState(p.is_active);
  const [pending, start] = useTransition();
  const low = p.stock_enabled && p.stock_qty <= p.stock_min;
  const pr = profitOf(p.price, p.cost);

  const toggle = () => {
    const next = !active;
    setActive(next);
    start(async () => {
      const r = await setProductActive(p.id, next);
      if (r.error) setActive(!next);
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 lg:flex-nowrap lg:px-5", !active && "bg-bg/50")}>
      <Link href={`/produtos/${p.id}`} className="group flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("font-semibold group-hover:text-brand", !active && "text-ink-3")}>{p.name}</span>
            {!active && <Pill>Pausado</Pill>}
            {p.option_groups.length > 0 && <Pill>{p.option_groups.map((g) => g.label).join(" · ")}</Pill>}
          </div>
          <p className="num mt-0.5 text-[13px] text-ink-2">
            {p.price_is_from && "a partir de "}
            <b className="text-ink">{brl(p.price)}</b>
            {p.unit === "kg" ? " por kg" : " por unidade"}
          </p>
          {p.cost > 0 ? (
            <p className="num mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
              <span>custo {brl(p.cost)}</span>
              <span className={cn("rounded-full px-1.5 py-px font-semibold", pr.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                lucro {brl(pr.profit)} · {pctFmt(pr.margin)}
              </span>
              {p.price_auto && <span>preço automático</span>}
            </p>
          ) : (
            <p className="mt-1 text-xs font-semibold text-amber-700">Sem custo cadastrado</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 lg:hidden" />
      </Link>

      <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
        {p.stock_enabled ? (
          <div className="flex items-center gap-2.5">
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", low ? "text-red-600" : "text-emerald-700")}>
              <PackageCheck className="h-3.5 w-3.5" />
              {p.stock_qty === 0 ? "Esgotado" : "Prontos"}
            </span>
            <StockStepper id={p.id} value={p.stock_qty} unit={p.unit} />
          </div>
        ) : (
          <span className="text-xs text-ink-3">Sob encomenda</span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={toggle}
          disabled={pending}
          title={active ? "Pausar produto" : "Ativar produto"}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition", active ? "bg-emerald-500" : "bg-line-strong")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", active ? "left-[22px]" : "left-0.5")} />
        </button>
        <Link href={`/produtos/${p.id}`} className="hidden text-[13px] font-semibold text-ink-3 hover:text-ink lg:block">
          Editar
        </Link>
      </div>
    </div>
  );
}
