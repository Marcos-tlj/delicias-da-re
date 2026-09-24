"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product, SelectedOptions, Unit } from "./types";

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  price: number; // só para exibição — o banco recalcula no pedido
  unit: Unit;
  priceIsFrom: boolean;
  min: number;
  step: number;
  quantity: number;
  options: SelectedOptions;
  note?: string;
  imageUrl: string | null;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (product: Product, quantity: number, options: SelectedOptions, note?: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "delicias-da-re:cart:v1";
const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Carrega a sacola salva (sobrevive a fechar o navegador)
  useEffect(() => {
    setItems(readStorage());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* modo privado / armazenamento cheio: a sacola continua em memória */
    }
  }, [items, ready]);

  const add = useCallback<CartContextValue["add"]>((product, quantity, options, note) => {
    const cleanNote = note?.trim() || undefined;
    const key = `${product.id}|${JSON.stringify(options)}|${cleanNote ?? ""}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          unit: product.unit,
          priceIsFrom: product.price_is_from,
          min: Number(product.min_quantity),
          step: Number(product.quantity_step),
          quantity,
          options,
          note: cleanNote,
          imageUrl: product.image_url,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        const q = Math.round(quantity * 100) / 100;
        return q < i.min ? [] : [{ ...i, quantity: q }];
      }),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = items.reduce((s, i) => s + (i.unit === "kg" ? 1 : i.quantity), 0);
    return { items, ready, count, subtotal, add, setQuantity, remove, clear };
  }, [items, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de <CartProvider>");
  return ctx;
}
