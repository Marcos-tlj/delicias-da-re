"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_LABEL, brl, formatDateTime, statusLabel, whatsappLink } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import OrderItemsList from "@/components/OrderItemsList";

const FLOW: OrderStatus[] = ["pendente", "aceito", "em_preparo", "saiu_entrega", "finalizado"];
const ICON: Record<OrderStatus, string> = {
  pendente: "📝",
  aceito: "👍",
  em_preparo: "👩‍🍳",
  saiu_entrega: "🛵",
  finalizado: "🎉",
  cancelado: "✖️",
};

export default function OrderTracker({
  initial,
  isNew,
  whatsapp,
  pixKey,
}: {
  initial: Order;
  isNew: boolean;
  whatsapp: string;
  pixKey: string;
}) {
  const [order, setOrder] = useState(initial);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", initial.id).maybeSingle();
    if (data) setOrder(data as Order);
  }, [initial.id]);

  // Atualização em tempo real (o Realtime respeita o RLS)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`order-${initial.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${initial.id}` },
          (payload) => {
            setOrder((o) => ({ ...o, ...(payload.new as Partial<Order>) }));
            if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          },
        )
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    })();

    // Celular bloqueado derruba a conexão: ao voltar, busca o estado atual
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [initial.id, refetch]);

  const currentIdx = FLOW.indexOf(order.status);
  const cancelled = order.status === "cancelado";
  const items = order.order_items ?? [];

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const waText = `Olá! Acabei de fazer o pedido #${order.code} pelo site (${brl(order.total)}).`;

  return (
    <div className="pb-28">
      <PageHeader title={`Pedido #${order.code}`} back="/pedidos" />

      <div className="space-y-4 p-4">
        {isNew && (
          <div className="animate-pop rounded-3xl bg-emerald-50 p-4 text-center text-emerald-900">
            <p className="text-3xl">🎂</p>
            <p className="font-bold">Pedido enviado!</p>
            <p className="text-sm">Você vai acompanhar cada etapa aqui, em tempo real.</p>
          </div>
        )}

        {/* Status atual */}
        <section className="rounded-3xl bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-cocoa-light">Status</p>
            <span className={`flex items-center gap-1.5 text-xs ${live ? "text-emerald-700" : "text-cocoa-light"}`}>
              <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-stone-300"}`} />
              {live ? "ao vivo" : "conectando…"}
            </span>
          </div>
          <p className="font-display mt-1 text-2xl font-semibold">
            {ICON[order.status]} {statusLabel(order.status, order.delivery_type)}
          </p>

          {cancelled ? (
            <p className="mt-3 text-sm text-cocoa-light">
              Este pedido foi cancelado. Fale com a gente no WhatsApp se tiver dúvidas.
            </p>
          ) : (
            <ol className="mt-5 space-y-0">
              {FLOW.map((s, idx) => {
                const done = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <li key={s} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                          done ? "bg-berry text-white" : "bg-cream-dark text-cocoa-light"
                        } ${isCurrent ? "ring-4 ring-berry/20" : ""}`}
                      >
                        {done ? "✓" : idx + 1}
                      </span>
                      {idx < FLOW.length - 1 && (
                        <span className={`h-6 w-0.5 ${idx < currentIdx ? "bg-berry" : "bg-cream-dark"}`} />
                      )}
                    </div>
                    <p className={`pt-1 text-sm ${done ? "font-bold" : "text-cocoa-light"}`}>
                      {statusLabel(s, order.delivery_type)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* PIX */}
        {order.payment_method === "pix" && !cancelled && order.status !== "finalizado" && (
          <section className="rounded-3xl bg-white p-5">
            <p className="font-bold">⚡ Pagamento via PIX</p>
            {pixKey ? (
              <>
                <p className="mt-1 text-sm text-cocoa-light">
                  Aguarde a confirmação do pedido e o valor final. Depois é só pagar nesta chave e mandar o comprovante:
                </p>
                <button
                  onClick={copyPix}
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-cocoa-light px-4 py-3 text-left"
                >
                  <span className="truncate font-mono text-sm">{pixKey}</span>
                  <span className="ml-2 shrink-0 text-sm font-bold text-berry">{copied ? "Copiado!" : "Copiar"}</span>
                </button>
              </>
            ) : (
              <p className="mt-1 text-sm text-cocoa-light">Enviaremos a chave PIX pelo WhatsApp após confirmar o pedido.</p>
            )}
          </section>
        )}

        {whatsapp && (
          <a
            href={whatsappLink(whatsapp, waText)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 font-bold text-white"
          >
            Falar no WhatsApp
          </a>
        )}

        {/* Detalhes */}
        <section className="rounded-3xl bg-white p-5">
          <p className="mb-3 font-bold">Itens</p>
          <OrderItemsList items={items} />
          <div className="mt-4 space-y-1 border-t border-cream-dark pt-3 text-sm">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{brl(order.subtotal)}</span>
            </p>
            {order.delivery_type === "delivery" && (
              <p className="flex justify-between text-cocoa-light">
                <span>Entrega</span>
                <span>{Number(order.delivery_fee) > 0 ? brl(order.delivery_fee) : "a combinar"}</span>
              </p>
            )}
            <p className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{brl(order.total)}</span>
            </p>
          </div>
        </section>

        <section className="space-y-2 rounded-3xl bg-white p-5 text-sm">
          <p>
            <b>Feito em:</b> {formatDateTime(order.created_at)}
          </p>
          {order.scheduled_for && (
            <p>
              <b>Para:</b> {formatDateTime(order.scheduled_for)}
            </p>
          )}
          <p>
            <b>{order.delivery_type === "delivery" ? "Entrega em:" : "Retirada"}</b>{" "}
            {order.address &&
              `${order.address.street}, ${order.address.number}${
                order.address.complement ? ` - ${order.address.complement}` : ""
              } · ${order.address.neighborhood}`}
          </p>
          <p>
            <b>Pagamento:</b> {PAYMENT_LABEL[order.payment_method]}
          </p>
          {order.notes && (
            <p>
              <b>Obs.:</b> {order.notes}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
