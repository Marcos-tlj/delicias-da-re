import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, MessageCircle, Pencil, Phone, Store, User } from "lucide-react";
import { requireStaff } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_LABEL, brl, dueLabel, formatDateTime, isLate, optionsText, qty, whatsappLink } from "@/lib/format";
import { ButtonLink, Card, CardHeader, PageHeader, PaymentBadge, StatusBadge, cn } from "@/components/ui";
import OrderActions, { PaymentBox } from "./OrderActions";

export const metadata = { title: "Pedido" };

const FLOW: OrderStatus[] = ["novo", "confirmado", "em_preparo", "pronto", "entregue"];
const FLOW_LABEL: Record<string, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "order_items" })
    .maybeSingle();
  if (!data) notFound();
  const o = data as Order;
  const items = o.order_items ?? [];
  const late = isLate(o.due_at, o.status);
  const idx = FLOW.indexOf(o.status);
  const remaining = Math.max(0, Number(o.total) - Number(o.amount_paid));
  const orderCost = items.reduce((a, i) => a + (Number(i.unit_cost) || 0) * Number(i.quantity), 0);

  const waText = `Olá, ${o.customer_name.split(" ")[0]}! Aqui é da Delícias da Rê, sobre o seu pedido #${o.code}`;

  return (
    <>
      <PageHeader
        back={{ href: "/pedidos", label: "Pedidos" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Pedido #{o.code}
            <StatusBadge status={o.status} />
          </span>
        }
        subtitle={`Criado em ${formatDateTime(o.created_at)}`}
        actions={
          <>
            {o.customer_phone && (
              <a href={whatsappLink(o.customer_phone, waText)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-95">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            <ButtonLink href={`/pedidos/${o.id}/editar`}>
              <Pencil className="h-4 w-4" /> Editar
            </ButtonLink>
          </>
        }
      />

      {/* Linha do tempo */}
      {o.status !== "cancelado" && (
        <Card className="mb-5 p-4 lg:p-5">
          <ol className="flex items-center">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      i < idx && "bg-ink text-white",
                      i === idx && "bg-brand text-white ring-4 ring-brand-soft",
                      i > idx && "bg-bg text-ink-3 ring-1 ring-line",
                    )}
                  >
                    {i < idx ? "✓" : i + 1}
                  </span>
                  <span className={cn("hidden text-xs font-semibold sm:block", i <= idx ? "text-ink" : "text-ink-3")}>{FLOW_LABEL[s]}</span>
                </div>
                {i < FLOW.length - 1 && <span className={cn("mx-1.5 h-0.5 flex-1 rounded sm:mb-5", i < idx ? "bg-ink" : "bg-line")} />}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:gap-6">
        <div className="space-y-5">
          <OrderActions id={o.id} status={o.status} code={o.code} />

          {/* Itens */}
          <Card className="overflow-hidden">
            <CardHeader title="Itens" subtitle={`${items.length} item(ns)`} />
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-3 px-4 py-3.5 lg:px-5">
                  <span className="num mt-0.5 min-w-14 rounded-lg bg-bg px-2 py-1 text-center text-[13px] font-bold">{qty(i.quantity, i.unit)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.product_name}</p>
                    {optionsText(i.options) && <p className="text-[13px] text-ink-2">{optionsText(i.options)}</p>}
                    {i.note && <p className="text-[13px] text-ink-3 italic">“{i.note}”</p>}
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold">{brl(i.line_total)}</p>
                    <p className="num text-xs text-ink-3">
                      {brl(i.unit_price)}
                      {i.unit === "kg" ? "/kg" : "/un"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="num space-y-1.5 border-t border-line bg-bg/40 px-4 py-3.5 text-sm lg:px-5">
              <div className="flex justify-between text-ink-2">
                <dt>Subtotal</dt>
                <dd>{brl(o.subtotal)}</dd>
              </div>
              {Number(o.delivery_fee) > 0 && (
                <div className="flex justify-between text-ink-2">
                  <dt>Entrega</dt>
                  <dd>{brl(o.delivery_fee)}</dd>
                </div>
              )}
              {Number(o.discount) > 0 && (
                <div className="flex justify-between text-ink-2">
                  <dt>Desconto</dt>
                  <dd>− {brl(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{brl(o.total)}</dd>
              </div>
              {orderCost > 0 && (
                <div className="flex justify-between border-t border-line pt-1.5 text-[13px] text-ink-3">
                  <dt>Custo de produção · lucro</dt>
                  <dd>
                    {brl(orderCost)} ·{" "}
                    <b className={Number(o.total) - orderCost >= 0 ? "text-emerald-700" : "text-red-600"}>{brl(Number(o.total) - orderCost)}</b>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {o.notes && (
            <Card className="p-4 lg:p-5">
              <p className="mb-1 text-[13px] font-semibold text-ink-3">Observações</p>
              <p className="whitespace-pre-wrap">{o.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Entrega */}
          <Card className="p-4 lg:p-5">
            <p className="mb-3 text-[13px] font-semibold text-ink-3">{o.delivery_type === "entrega" ? "Entrega" : "Retirada"}</p>
            <div className="space-y-3 text-sm">
              <p className={cn("flex items-start gap-2.5", late && "font-semibold text-red-600")}>
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                {o.due_at ? `${dueLabel(o.due_at)}${late ? " (atrasado)" : ""}` : "Sem data definida"}
              </p>
              {o.delivery_type === "entrega" ? (
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                  {o.address ? (
                    <a
                      className="underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                    >
                      {o.address}
                    </a>
                  ) : (
                    "Endereço não informado"
                  )}
                </p>
              ) : (
                <p className="flex items-center gap-2.5">
                  <Store className="h-4 w-4 text-ink-3" /> Cliente retira na confeitaria
                </p>
              )}
            </div>
          </Card>

          {/* Cliente */}
          <Card className="p-4 lg:p-5">
            <p className="mb-3 text-[13px] font-semibold text-ink-3">Cliente</p>
            <div className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2.5 font-semibold">
                <User className="h-4 w-4 text-ink-3" />
                {o.customer_id ? (
                  <Link href={`/clientes/${o.customer_id}`} className="hover:text-brand">
                    {o.customer_name}
                  </Link>
                ) : (
                  o.customer_name
                )}
              </p>
              {o.customer_phone && (
                <a href={`tel:${o.customer_phone.replace(/\D/g, "")}`} className="flex items-center gap-2.5 hover:text-brand">
                  <Phone className="h-4 w-4 text-ink-3" /> {o.customer_phone}
                </a>
              )}
            </div>
          </Card>

          {/* Pagamento */}
          <Card className="p-4 lg:p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink-3">Pagamento</p>
              <PaymentBadge status={o.payment_status} />
            </div>
            <dl className="num space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-2">Forma</dt>
                <dd className="font-medium">{o.payment_method ? PAYMENT_LABEL[o.payment_method] : "A definir"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Pago</dt>
                <dd className="font-medium text-emerald-700">{brl(o.amount_paid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Falta receber</dt>
                <dd className={cn("font-bold", remaining > 0 ? "text-red-600" : "text-ink")}>{brl(remaining)}</dd>
              </div>
            </dl>
            <PaymentBox id={o.id} total={Number(o.total)} paid={Number(o.amount_paid)} />
          </Card>
        </div>
      </div>
    </>
  );
}
