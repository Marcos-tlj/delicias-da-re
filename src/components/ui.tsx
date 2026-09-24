import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/format";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------------- Botões ----------------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
  dark: "bg-ink text-white hover:bg-black shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-bg hover:border-line-strong shadow-[var(--shadow-card)]",
  ghost: "text-ink-2 hover:bg-black/5 hover:text-ink",
  danger: "bg-surface text-red-700 border border-red-200 hover:bg-red-50",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---------------- Formulários ----------------
export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 h-11 lg:h-10 text-ink placeholder:text-ink-3 outline-none transition focus:border-ink-2 focus:ring-4 focus:ring-black/5 disabled:bg-bg";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select className={cn(inputClass, "appearance-none pr-9")} {...props} />
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="block text-[13px] text-ink-3">{description}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-emerald-500" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex w-full rounded-xl border border-line bg-bg p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Estrutura ----------------
export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 lg:mb-7">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bg text-ink-3">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[13px] text-ink-3">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------- Etiquetas ----------------
const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: "bg-sky-50 text-sky-700 ring-sky-600/15",
  confirmado: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
  em_preparo: "bg-amber-50 text-amber-800 ring-amber-600/20",
  pronto: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  entregue: "bg-stone-100 text-stone-600 ring-stone-500/15",
  cancelado: "bg-red-50 text-red-700 ring-red-600/15",
};
const STATUS_DOT: Record<OrderStatus, string> = {
  novo: "bg-sky-500",
  confirmado: "bg-indigo-500",
  em_preparo: "bg-amber-500",
  pronto: "bg-emerald-500",
  entregue: "bg-stone-400",
  cancelado: "bg-red-500",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap", STATUS_STYLE[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PAY_STYLE: Record<PaymentStatus, string> = {
  pago: "text-emerald-700",
  parcial: "text-amber-700",
  pendente: "text-red-600",
};
const PAY_LABEL: Record<PaymentStatus, string> = { pago: "Pago", parcial: "Pago parcial", pendente: "A receber" };

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={cn("text-xs font-semibold whitespace-nowrap", PAY_STYLE[status])}>{PAY_LABEL[status]}</span>;
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-inset ring-line whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{children}</p>;
}
