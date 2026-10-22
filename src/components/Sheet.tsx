"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Janela que sobe de baixo no celular e fica centralizada no computador. Abre fora do formulário da página (portal). */
export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar" />
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-sheet pb-safe relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-3 hover:bg-bg" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
