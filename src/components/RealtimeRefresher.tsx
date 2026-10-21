"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Quando você ou sua mãe mudam algo, a tela da outra atualiza sozinha. */
export default function RealtimeRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 500);
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel("app-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, refresh)
        .subscribe();
    })();

    // ao voltar para o app, só recarrega se ficou fora por mais de 30 s
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
