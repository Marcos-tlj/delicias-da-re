import type { DeliveryType, OrderStatus, PaymentMethod, SelectedOptions, Unit } from "./types";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number) => brlFmt.format(Number(v) || 0);

export function formatQty(qty: number, unit: Unit) {
  const n = Number(qty);
  if (unit === "kg") return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
  return `${n}x`;
}

export function priceLabel(price: number, unit: Unit, from = false) {
  return `${from ? "a partir de " : ""}${brl(price)}${unit === "kg" ? "/kg" : ""}`;
}

export function optionsText(options: SelectedOptions | null | undefined) {
  if (!options) return "";
  return Object.entries(options)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(", ") : v;
      return val ? `${k.replace(/\s*\(.*\)$/, "")}: ${val}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendente: "Aguardando confirmação",
  aceito: "Pedido aceito",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu para entrega",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export function statusLabel(status: OrderStatus, delivery: DeliveryType) {
  if (status === "saiu_entrega" && delivery === "retirada") return "Pronto para retirada";
  return STATUS_LABEL[status];
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  pendente: "bg-amber-100 text-amber-800",
  aceito: "bg-sky-100 text-sky-800",
  em_preparo: "bg-violet-100 text-violet-800",
  saiu_entrega: "bg-orange-100 text-orange-800",
  finalizado: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-stone-200 text-stone-600",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  cartao_entrega: "Cartão na entrega/retirada",
};

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Evita open-redirect: só aceita caminhos internos. */
export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
