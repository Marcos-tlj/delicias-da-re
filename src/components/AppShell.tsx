"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Cake,
  ClipboardList,
  Home,
  Layers,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "./ui";
import { signOut } from "@/app/(app)/actions";

const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos e estoque", short: "Produtos", icon: Cake },
  { href: "/sabores", label: "Sabores e opções", short: "Sabores", icon: Layers },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function Brand({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
        <Cake className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className={cn("font-display block text-[17px] font-semibold", light ? "text-white" : "text-ink")}>
          Delícias da Rê
        </span>
        <span className={cn("block text-[11px] font-medium tracking-wide uppercase", light ? "text-white/45" : "text-ink-3")}>
          Gestão de pedidos
        </span>
      </span>
    </Link>
  );
}

export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [path]);

  const initial = userName.trim().charAt(0).toUpperCase() || "R";

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ------- Sidebar (computador) ------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-cocoa px-4 py-5 lg:flex">
        <div className="px-2">
          <Brand light />
        </div>

        <Link
          href="/pedidos/novo"
          className="mt-7 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Novo pedido
        </Link>

        <nav className="mt-6 space-y-0.5">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
                  active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">{userName}</span>
          <form action={signOut}>
            <button className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* ------- Topo (celular) ------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 pt-[calc(env(safe-area-inset-top)+0.625rem)] pb-2.5 backdrop-blur-md lg:hidden">
        <Brand />
        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-sm font-bold ring-1 ring-line"
          aria-label="Menu"
        >
          {initial}
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>

      {/* ------- Barra inferior (celular) ------- */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5 items-end">
          {[NAV[0], NAV[1]].map((n) => (
            <TabLink key={n.href} href={n.href} label={n.label} icon={n.icon} active={isActive(path, n.href)} />
          ))}
          <div className="flex justify-center">
            <Link
              href="/pedidos/novo"
              className="-mt-5 mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-[var(--shadow-pop)] active:scale-95"
              aria-label="Novo pedido"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Link>
          </div>
          <TabLink href="/clientes" label="Clientes" icon={Users} active={isActive(path, "/clientes")} />
          <button
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold",
              ["/produtos", "/sabores", "/configuracoes"].some((h) => isActive(path, h)) ? "text-brand" : "text-ink-3",
            )}
          >
            <Menu className="h-[22px] w-[22px]" strokeWidth={1.9} />
            Mais
          </button>
        </div>
      </nav>

      {/* ------- Menu "Mais" (celular) ------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="animate-fade-in absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label="Fechar" />
          <div className="animate-sheet pb-safe absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface px-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-center justify-between px-2 pb-3">
              <p className="font-semibold">{userName}</p>
              <button onClick={() => setMenuOpen(false)} className="rounded-full p-1.5 text-ink-3 hover:bg-bg" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1 pb-3">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 font-medium",
                    isActive(path, n.href) ? "bg-brand-soft text-brand-dark" : "text-ink hover:bg-bg",
                  )}
                >
                  <n.icon className="h-5 w-5" strokeWidth={1.9} />
                  {n.label}
                </Link>
              ))}
              <form action={signOut}>
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-medium text-red-600 hover:bg-red-50">
                  <LogOut className="h-5 w-5" /> Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold", active ? "text-brand" : "text-ink-3")}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </Link>
  );
}
