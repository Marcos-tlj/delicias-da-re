"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/format";

export default function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("erro") ? "Não foi possível entrar. Tente de novo." : "");

  const supabase = createClient();
  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const google = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError("Login com Google indisponível no momento.");
      setLoading(false);
    }
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: true },
    });
    setLoading(false);
    if (error) setError("Não conseguimos enviar o e-mail. Confira o endereço e tente de novo.");
    else setStep("code");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setLoading(false);
    if (error) setError("Código inválido ou expirado.");
    else {
      router.replace(next);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8">
      <Link href="/" className="text-sm font-semibold text-cocoa-light">
        ‹ Voltar ao cardápio
      </Link>
      <div className="mt-10 text-center">
        <span className="text-6xl">🎂</span>
        <h1 className="font-display mt-3 text-3xl font-semibold">Delícias da Rê</h1>
        <p className="mt-2 text-cocoa-light">Entre para fazer e acompanhar seus pedidos.</p>
      </div>

      {error && <p className="mt-6 rounded-2xl bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}

      {step === "email" ? (
        <div className="mt-8 space-y-4">
          <button
            onClick={google}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cream-dark bg-white py-3.5 font-bold disabled:opacity-60"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continuar com Google
          </button>

          <div className="flex items-center gap-3 text-xs text-cocoa-light">
            <span className="h-px flex-1 bg-cream-dark" /> ou com e-mail <span className="h-px flex-1 bg-cream-dark" />
          </div>

          <form onSubmit={sendEmail} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-2xl border border-cream-dark bg-white px-4 py-3.5 outline-none focus:border-cocoa"
            />
            <button
              disabled={loading}
              className="w-full rounded-2xl bg-cocoa py-3.5 font-bold text-cream disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Receber link de acesso"}
            </button>
          </form>
        </div>
      ) : (
        <form onSubmit={verifyCode} className="mt-8 space-y-3">
          <p className="rounded-2xl bg-white p-4 text-center text-sm">
            Enviamos um e-mail para <b>{email}</b>.<br />
            Toque no link do e-mail <b>ou</b> digite o código abaixo.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Código do e-mail"
            className="w-full rounded-2xl border border-cream-dark bg-white px-4 py-3.5 text-center text-2xl tracking-[0.4em] outline-none focus:border-cocoa"
          />
          <button
            disabled={loading || code.length < 6}
            className="w-full rounded-2xl bg-berry py-3.5 font-bold text-white disabled:opacity-50"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
          <button type="button" onClick={() => setStep("email")} className="w-full py-2 text-sm font-semibold text-cocoa-light">
            Usar outro e-mail
          </button>
        </form>
      )}
    </div>
  );
}
