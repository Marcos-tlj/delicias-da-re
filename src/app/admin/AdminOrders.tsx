"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";
import { PAYMENT_LABEL, STATUS_LABEL, brl, formatDateTime, statusLabel, whatsappLink } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import OrderItemsList from "@/components/OrderItemsList";
import { updateOrderStatus } from "./actions";

type Tab = "novos" | "andamento" | "concluidos";
const TAB_STATUSES: Record<Tab, OrderStatus[]> = {
  novos: ["pendente"],
  andamento: ["aceito", "em_preparo", "saiu_entrega"],
  concluidos: ["finalizado", "cancelado"],
};

/** Próximo passo "rápido" para cada status */
function nextActions(o: Order): { label: string; to: OrderStatus; tone: "primary" | "danger" }[] {
  switch (o.status) {
    case "pendente":
      return [
        { label: "Recusar", to: "cancelado", tone: "danger" },
        { label: "✓ Aceitar", to: "aceito", tone: "primary" },
      ];
    case "aceito":
      return [{ label: "👩‍🍳 Em preparo", to: "em_preparo", tone: "primary" }];
    case "em_preparo":
      return [
        {
          label: o.delivery_type === "delivery" ? "🛵 Saiu para entrega" : "📦 Pronto p/ retirada",
          to: "saiu_entrega",
          tone: "primary",
        },
      ];
    case "saiu_entrega":
      return [{ label: "🎉 Finalizar", to: "finalizado", tone: "primary" }];
    default:
      return [];
  }
}

/** Toca um "plim-plom" sintetizado (não precisa de arquivo de áudio). */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [
    [880, 0],
    [1318.5, 0.18],
    [880, 0.5],
    [1318.5, 0.68],
  ].forEach(([freq, t]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(0.6, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.4);
  });
}

export default function AdminOrders({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [tab, setTab] = useState<Tab>("novos");
  const [live, setLive] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const [toast, setToast] = useState("");
  const [, startTransition] = useTransition();
  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const alertsOnRef = useRef(false);

  const ring = useCallback(() => {
    if (!alertsOnRef.current || !audioRef.current) return;
    audioRef.current.resume().then(() => chime(audioRef.current!));
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }, []);

  const fetchOrder = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", id).single();
    return data as Order | null;
  }, []);

  const refetchAll = useCallback(async () => {
    const supabase = createClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .or(`status.in.(pendente,aceito,em_preparo,saiu_entrega),created_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setOrders(data as Order[]);
  }, []);

  // Realtime: novos pedidos e mudanças de status
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
        .channel("admin-orders")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
          const full = await fetchOrder((payload.new as Order).id);
          if (!full) return;
          setOrders((prev) => (prev.some((o) => o.id === full.id) ? prev : [full, ...prev]));
          setTab("novos");
          setToast(`Novo pedido #${full.code} de ${full.customer_name}!`);
          ring();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
          const n = payload.new as Order;
          setOrders((prev) => prev.map((o) => (o.id === n.id ? { ...o, ...n, order_items: o.order_items } : o)));
        })
        .subscribe((status) => {
          setLive(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") refetchAll(); // pega o que chegou durante a reconexão
        });
    })();

    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      refetchAll();
      // o wake lock é liberado quando a tela some; pede de novo
      if (alertsOnRef.current && "wakeLock" in navigator && !wakeRef.current) {
        try {
          wakeRef.current = await navigator.wakeLock.request("screen");
          wakeRef.current.addEventListener("release", () => (wakeRef.current = null));
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchOrder, refetchAll, ring]);

  const pendingCount = orders.filter((o) => o.status === "pendente").length;

  // Continua tocando a cada 20s enquanto houver pedido não aceito (estilo iFood)
  useEffect(() => {
    if (!alertsOn || pendingCount === 0) return;
    const t = setInterval(ring, 20000);
    return () => clearInterval(t);
  }, [alertsOn, pendingCount, ring]);

  // Título da aba pisca com a contagem
  useEffect(() => {
    document.title = pendingCount ? `(${pendingCount}) Novo pedido!` : "Painel — Delícias da Rê";
  }, [pendingCount]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const enableAlerts = async () => {
    if (alertsOn) {
      alertsOnRef.current = false;
      setAlertsOn(false);
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioRef.current = audioRef.current ?? new Ctx();
    await audioRef.current.resume();
    alertsOnRef.current = true;
    setAlertsOn(true);
    chime(audioRef.current); // toque de teste
    if ("wakeLock" in navigator) {
      try {
        wakeRef.current = await navigator.wakeLock.request("screen"); // mantém a tela acesa
        wakeRef.current.addEventListener("release", () => (wakeRef.current = null));
      } catch {}
    }
  };

  const changeStatus = (o: Order, to: OrderStatus) => {
    if (to === "cancelado" && !window.confirm(`Cancelar/recusar o pedido #${o.code}?`)) return;
    const previous = o.status;
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: to } : x))); // otimista
    startTransition(async () => {
      const res = await updateOrderStatus(o.id, to);
      if (res.error) {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: previous } : x)));
        setToast(res.error);
      }
    });
  };

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(TAB_STATUSES) as Tab[]).map((t) => [t, orders.filter((o) => TAB_STATUSES[t].includes(o.status)).length]),
      ) as Record<Tab, number>,
    [orders],
  );

  const visible = orders
    .filter((o) => TAB_STATUSES[tab].includes(o.status))
    .sort((a, b) =>
      tab === "concluidos"
        ? b.updated_at.localeCompare(a.updated_at)
        : a.created_at.localeCompare(b.created_at), // mais antigos primeiro na fila
    );

  return (
    <div className="pb-16">
      {/* Barra de alertas */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <button
          onClick={enableAlerts}
          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold ${
            alertsOn ? "bg-emerald-100 text-emerald-800" : "animate-pulse bg-berry text-white"
          }`}
        >
          {alertsOn ? "🔔 Alertas ligados (tela acesa)" : "🔕 Toque para ligar o som de novos pedidos"}
        </button>
        <span
          className={`flex items-center gap-1 text-xs ${live ? "text-emerald-700" : "text-cocoa-light"}`}
          title="Conexão em tempo real"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${live ? "bg-emerald-500" : "bg-stone-300"}`} />
          {live ? "ao vivo" : "…"}
        </span>
      </div>

      {/* Abas */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+6.4rem)] z-10 grid grid-cols-3 gap-2 bg-cream px-4 py-3">
        {(
          [
            ["novos", "Novos"],
            ["andamento", "Em andamento"],
            ["concluidos", "Concluídos"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-2xl py-2 text-sm font-bold ${tab === t ? "bg-cocoa text-cream" : "bg-white"}`}
          >
            {label}
            <span
              className={`ml-1 rounded-full px-1.5 text-xs ${
                t === "novos" && counts.novos > 0 ? "bg-berry text-white" : "opacity-60"
              }`}
            >
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="p-10 text-center text-cocoa-light">
          {tab === "novos" ? "Nenhum pedido novo. Assim que chegar um, ele aparece aqui. 🎂" : "Nada por aqui."}
        </p>
      )}

      <ul className="space-y-3 px-4">
        {visible.map((o) => (
          <li
            key={o.id}
            className={`rounded-3xl bg-white p-4 ${o.status === "pendente" ? "animate-pop ring-2 ring-berry" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">#{o.code} · {o.customer_name}</p>
                <p className="text-xs text-cocoa-light">Recebido {formatDateTime(o.created_at)}</p>
              </div>
              <StatusBadge status={o.status} delivery={o.delivery_type} />
            </div>

            {o.scheduled_for && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                📅 Para {formatDateTime(o.scheduled_for)}
              </p>
            )}

            <div className="mt-3 rounded-2xl bg-cream p-3">
              <OrderItemsList items={o.order_items ?? []} />
              <p className="mt-2 flex justify-between border-t border-cream-dark pt-2 font-bold">
                <span>Total</span>
                <span>{brl(o.total)}</span>
              </p>
            </div>

            <div className="mt-3 space-y-1 text-sm">
              <p>
                {o.delivery_type === "delivery" ? "🛵 " : "🏠 Retirada"}
                {o.address && (
                  <a
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${o.address.street}, ${o.address.number} - ${o.address.neighborhood} ${o.address.city ?? ""}`,
                    )}`}
                  >
                    {o.address.street}, {o.address.number}
                    {o.address.complement ? ` (${o.address.complement})` : ""} · {o.address.neighborhood}
                  </a>
                )}
              </p>
              {o.address?.reference && <p className="text-cocoa-light">Ref.: {o.address.reference}</p>}
              <p>💰 {PAYMENT_LABEL[o.payment_method]}</p>
              {o.notes && <p className="rounded-xl bg-amber-50 p-2">📝 {o.notes}</p>}
              <a
                href={whatsappLink(o.customer_phone, `Olá, ${o.customer_name.split(" ")[0]}! Sobre seu pedido #${o.code} na Delícias da Rê:`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-bold text-emerald-700"
              >
                💬 WhatsApp {o.customer_phone}
              </a>
            </div>

            {nextActions(o).length > 0 && (
              <div className="mt-4 flex gap-2">
                {nextActions(o).map((a) => (
                  <button
                    key={a.to}
                    onClick={() => changeStatus(o, a.to)}
                    className={`rounded-2xl py-3.5 font-bold active:scale-[0.98] ${
                      a.tone === "primary" ? "flex-[2] bg-berry text-white" : "flex-1 border border-berry text-berry"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-3 flex items-center justify-end gap-2 text-xs text-cocoa-light">
              Corrigir status:
              <select
                value={o.status}
                onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                className="rounded-lg border border-cream-dark bg-white px-2 py-1 text-xs"
              >
                {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, o.delivery_type)}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>

      {toast && (
        <div className="animate-pop fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 mx-auto max-w-md rounded-2xl bg-cocoa px-4 py-3 text-center font-bold text-cream shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
