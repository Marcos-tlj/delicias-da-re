import Link from "next/link";
import { Clock, MapPin, Store } from "lucide-react";
import type { Order } from "@/lib/types";
import { brl, dueLabel, formatTime, isLate, qty } from "@/lib/format";
import { PaymentBadge, StatusBadge, cn } from "./ui";
import QuickAdvance from "./QuickAdvance";

export function itemsSummary(o: Order) {
  return (o.order_items ?? []).map((i) => `${qty(i.quantity, i.unit)} ${i.product_name}`).join(" · ");
}

/** Linha de pedido usada na agenda e na lista (se adapta a celular e computador). */
export default function OrderCard({ order: o, showDate = true }: { order: Order; showDate?: boolean }) {
  const late = isLate(o.due_at, o.status);
  return (
    <Link
      href={`/pedidos/${o.id}`}
      className="group flex gap-3 px-4 py-3.5 transition hover:bg-bg/70 lg:items-center lg:gap-5 lg:px-5"
    >
      <div
        className={cn(
          "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 text-center lg:w-16",
          late ? "bg-red-50 text-red-700" : "bg-bg text-ink",
        )}
      >
        {o.due_at ? (
          <>
            <span className="num text-[15px] leading-tight font-bold">{formatTime(o.due_at)}</span>
            {showDate && <span className="text-[10.5px] leading-tight font-semibold opacity-70">{dueLabel(o.due_at).split(" · ")[0]}</span>}
          </>
        ) : (
          <Clock className="h-4 w-4 text-ink-3" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{o.customer_name}</span>
          <span className="num text-xs text-ink-3">#{o.code}</span>
          {late && <span className="text-xs font-bold text-red-600">Atrasado</span>}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-2">{itemsSummary(o) || "Sem itens"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            {o.delivery_type === "entrega" ? <MapPin className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
            {o.delivery_type === "entrega" ? "Entrega" : "Retirada"}
          </span>
          <span className="lg:hidden">
            <StatusBadge status={o.status} />
          </span>
        </div>
      </div>

      <div className="hidden w-28 lg:block">
        <StatusBadge status={o.status} />
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-1 lg:w-28">
        <span className="num font-semibold">{brl(o.total)}</span>
        <PaymentBadge status={o.payment_status} />
      </div>

      <div className="hidden w-40 justify-end lg:flex">
        <QuickAdvance id={o.id} status={o.status} />
      </div>
    </Link>
  );
}
