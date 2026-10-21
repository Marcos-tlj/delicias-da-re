"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cake, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, Input, Segmented } from "@/components/ui";

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("database error") || m.includes("email_nao_autorizado") || m.includes("saving new user"))
    return "Este e-mail não está autorizado. Peça para quem já tem acesso liberar em Configurações.";
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Esse e-mail já tem conta. Use “Entrar”.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("email not confirmed")) return "Falta confirmar o e-mail: abra o link que enviamos para a sua caixa de entrada (veja também o spam).";
  if (m.includes("rate limit") || m.includes("security purposes")) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  return "Não foi possível entrar. Tente novamente.";
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(
    params.get("erro") === "acesso"
      ? "Sua conta não tem acesso a este sistema."
      : params.get("erro") === "link"
        ? "Se você tocou no link do e-mail, a confirmação já foi feita. Agora é só entrar com seu e-mail e senha."
        : "",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (params.get("erro") === "acesso") await supabase.auth.signOut();

    const res =
      mode === "entrar"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    if (res.error) {
      setError(friendly(res.error.message));
      setLoading(false);
      return;
    }
    // e-mail que já tem conta: o Supabase responde "ok" sem reenviar nada
    if (mode === "criar" && !res.data.session && res.data.user && (res.data.user.identities ?? []).length === 0) {
      setMode("entrar");
      setNotice("Esse e-mail já tem conta. Entre com a sua senha.");
      setLoading(false);
      return;
    }
    if (mode === "criar" && !res.data.session) {
      // confirmação de e-mail ligada (mais seguro): o link leva direto para dentro do sistema
      setNotice(`Quase lá! Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail neste mesmo aparelho e navegador e toque no link para entrar. Se não aparecer, veja o spam.`);
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Lado decorativo (computador) */}
      <div className="relative hidden overflow-hidden bg-cocoa lg:block">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand">
              <Cake className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-semibold">Delícias da Rê</span>
          </div>
          <div>
            <p className="font-display text-4xl leading-tight font-semibold">
              Pedidos, clientes e estoque
              <br />
              num só lugar.
            </p>
            <p className="mt-4 max-w-md text-white/60">
              Agenda de entregas, bolos prontos disponíveis, sabores e valores sempre atualizados, no computador e no
              celular.
            </p>
          </div>
          <p className="text-sm text-white/40">Acesso restrito à equipe.</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
              <Cake className="h-6 w-6" />
            </span>
            <p className="font-display mt-3 text-2xl font-semibold">Delícias da Rê</p>
            <p className="text-sm text-ink-3">Gestão de pedidos</p>
          </div>

          <h1 className="text-xl font-bold">{mode === "entrar" ? "Entrar" : "Primeiro acesso"}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {mode === "entrar"
              ? "Use o e-mail e a senha cadastrados."
              : "Crie sua senha. Só funciona para e-mails liberados."}
          </p>

          <Segmented
            className="mt-5"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setError("");
            }}
            options={[
              { value: "entrar", label: "Entrar" },
              { value: "criar", label: "Primeiro acesso" },
            ]}
          />

          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "criar" && (
              <Field label="Seu nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Senha" hint={mode === "criar" ? "Mínimo de 8 caracteres." : undefined}>
              <Input
                type="password"
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                minLength={mode === "criar" ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            {notice && (
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                {notice}
              </p>
            )}
            <Button variant="dark" size="lg" className="w-full" disabled={loading}>
              <Lock className="h-4 w-4" />
              {loading ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar acesso"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
