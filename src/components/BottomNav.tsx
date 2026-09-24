"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

const TABS = [
  { href: "/", label: "Cardápio", icon: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/carrinho", label: "Sacola", icon: "M6 7h12l-1 13H7L6 7zm3 0a3 3 0 016 0" },
  { href: "/pedidos", label: "Pedidos", icon: "M8 4h8l1 2h2v14H5V6h2l1-2zm0 7h8M8 15h5" },
  { href: "/conta", label: "Conta", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { count, ready } = useCart();

  if (pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/checkout"))
    return null;

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-cream-dark bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold ${
                  active ? "text-berry" : "text-cocoa-light"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
                {t.href === "/carrinho" && ready && count > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2 min-w-5 rounded-full bg-berry px-1.5 text-center text-[10px] leading-5 text-white">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
