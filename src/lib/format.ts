import type { OrderStatus, PaymentMethod, SelectedOptions, Unit } from "./types";

export const TZ = "America/Sao_Paulo";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number | string | null | undefined) => brlFmt.format(Number(v) || 0);

export function qty(q: number | string, unit: Unit) {
  const n = Number(q);
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return unit === "kg" ? `${s} kg` : `${s} un`;
}

export function optionsText(options: SelectedOptions | null | undefined) {
  if (!options) return "";
  return Object.entries(options)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(", ") : v;
      return val ? `${k}: ${val}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

/** Próximo passo do fluxo (botão rápido). */
export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  novo: { to: "confirmado", label: "Confirmar" },
  confirmado: { to: "em_preparo", label: "Iniciar preparo" },
  em_preparo: { to: "pronto", label: "Marcar pronto" },
  pronto: { to: "entregue", label: "Marcar entregue" },
};

// ---------- Datas (sempre no fuso de São Paulo, igual no servidor e no navegador) ----------

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function spParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

/** "2026-09-24" no fuso de SP */
export function dayKey(date: Date | string) {
  const p = spParts(new Date(date));
  return `${p.y}-${p.m}-${p.d}`;
}

export function todayKey() {
  return dayKey(new Date());
}

export function addDaysKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

/** ISO -> valor de <input type="datetime-local"> em SP */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const p = spParts(new Date(iso));
  return `${p.y}-${p.m}-${p.d}T${p.h}:${p.min}`;
}

/** valor de datetime-local (hora de SP) -> ISO */
export function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(`${v}:00-03:00`).toISOString();
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, ...opts });
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)} às ${formatTime(iso)}`;
}

/** "Hoje", "Amanhã", "Ontem" ou "sex, 26/09" */
export function relativeDay(iso: string) {
  const k = dayKey(iso);
  const t = todayKey();
  if (k === t) return "Hoje";
  if (k === addDaysKey(t, 1)) return "Amanhã";
  if (k === addDaysKey(t, -1)) return "Ontem";
  return formatDate(iso, { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function dueLabel(iso: string | null) {
  if (!iso) return "Sem data";
  return `${relativeDay(iso)} · ${formatTime(iso)}`;
}

export function isLate(iso: string | null, status: OrderStatus) {
  if (!iso || status === "entregue" || status === "cancelado") return false;
  return new Date(iso).getTime() < Date.now();
}

export function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "12,5" -> 12.5 */
export function parseNum(v: string | number | null | undefined) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
}

export function numInput(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: false });
}
