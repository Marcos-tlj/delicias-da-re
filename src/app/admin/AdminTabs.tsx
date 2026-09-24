"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: "Pedidos" },
    { href: "/admin/produtos", label: "Cardápio" },
  ];
  return (
    <nav className="flex gap-1">
      {tabs.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 border-b-4 py-2 text-center text-sm font-bold ${
              active ? "border-berry" : "border-transparent opacity-70"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
