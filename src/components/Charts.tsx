"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SERIES = [
  { key: "bruto", label: "Rendimento bruto", color: "var(--color-s-bruto)" },
  { key: "gastos", label: "Gastos", color: "var(--color-s-gasto)" },
  { key: "lucro", label: "Lucro final", color: "var(--color-s-lucro)" },
] as const;

export type ChartPoint = { label: string; long: string; bruto: number; gastos: number; lucro: number; href?: string };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function short(v: number) {
  const a = Math.abs(v);
  if (a >= 1000) return `${v < 0 ? "-" : ""}R$ ${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}
function niceMax(v: number) {
  if (v <= 0) return 100;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Barras agrupadas (bruto, gastos, lucro) por período. Tocar num período abre os detalhes dele. */
export function GroupedBars({ data, selected }: { data: ChartPoint[]; selected: number }) {
  const router = useRouter();
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240,
    L = 58,
    R = 4,
    T = 12,
    B = 28;
  const max = Math.max(0, ...data.flatMap((d) => [d.bruto, d.gastos, d.lucro]));
  const min = Math.min(0, ...data.map((d) => d.lucro));
  const top = niceMax(max);
  const step = top / 4;
  const bot = min < 0 ? -Math.ceil(-min / step) * step : 0;
  const y = (v: number) => T + ((top - v) / (top - bot || 1)) * (H - T - B);
  const gw = (W - L - R) / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(16, (gw - 12) / 3 - 2));
  const ticks: number[] = [];
  for (let v = bot; v <= top + 1e-6; v += step) ticks.push(v);
  const tip = hover ?? null;

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Rendimento bruto, gastos e lucro por período" className="block overflow-visible">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {short(v)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = L + i * gw;
          const on = i === selected;
          const x0 = gx + (gw - (bw * 3 + 4)) / 2;
          return (
            <g
              key={i}
              onClick={() => d.href && router.push(d.href, { scroll: false })}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: d.href ? "pointer" : "default" }}
            >
              <rect x={gx + 2} y={T - 6} width={gw - 4} height={H - T - B + 10} rx={10} fill={on ? "var(--color-brand-soft)" : hover === i ? "var(--color-bg)" : "transparent"} />
              {SERIES.map((s, j) => {
                const v = d[s.key];
                const x = x0 + j * (bw + 2);
                const y0 = y(0),
                  y1 = y(v);
                const h = Math.abs(y0 - y1);
                if (h < 0.5) return null;
                const r = Math.min(4, h, bw / 2);
                const path =
                  v >= 0
                    ? `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 + r}V${y0}Z`
                    : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 - r}V${y0}Z`;
                return <path key={s.key} d={path} fill={s.color} opacity={on || hover === i ? 1 : 0.62} />;
              })}
              <text x={gx + gw / 2} y={H - 8} textAnchor="middle" fontSize="11" fontWeight={on ? 700 : 500} fill={on ? "var(--color-ink)" : "var(--color-ink-3)"}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {tip !== null && data[tip] && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 rounded-xl border border-line bg-surface p-3 text-[12.5px] shadow-[var(--shadow-pop)]"
          style={{ left: Math.min(Math.max(0, L + tip * gw + gw / 2 - 96), W - 192) }}
        >
          <p className="mb-1.5 font-semibold text-ink">{data[tip].long}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="num flex items-center justify-between gap-2 text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                {s.label}
              </span>
              <b className="text-ink">{brl.format(data[tip][s.key])}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barras simples de faturamento por dia (início). */
export function DayBars({ data }: { data: { label: string; long: string; value: number; today?: boolean }[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 132,
    T = 20,
    B = 22;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const peak = Math.max(...data.map((d) => d.value));
  const gw = W / Math.max(1, data.length);
  const bw = Math.min(30, gw * 0.56);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Vendas dos últimos 7 dias" className="block overflow-visible">
        <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="currentColor" strokeOpacity={0.25} />
        {data.map((d, i) => {
          const h = (d.value / max) * (H - T - B);
          const x = i * gw + (gw - bw) / 2;
          const y0 = H - B;
          const r = Math.min(4, h);
          return (
            <g key={i}>
              <title>{`${d.long}: ${brl.format(d.value)}`}</title>
              {h > 0.5 && (
                <path
                  d={`M${x},${y0}V${y0 - h + r}Q${x},${y0 - h} ${x + r},${y0 - h}H${x + bw - r}Q${x + bw},${y0 - h} ${x + bw},${y0 - h + r}V${y0}Z`}
                  fill="currentColor"
                  opacity={d.today ? 1 : 0.55}
                />
              )}
              {(d.today || (d.value === peak && peak > 0)) && (
                <text x={x + bw / 2} y={y0 - h - 6} textAnchor="middle" fontSize="11" fontWeight={700} fill="currentColor">
                  {short(d.value)}
                </text>
              )}
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fontWeight={d.today ? 700 : 500} fill="currentColor" opacity={d.today ? 1 : 0.7}>
                {d.today ? "hoje" : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
