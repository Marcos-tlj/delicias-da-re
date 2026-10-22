"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { addAllowedEmail, removeAllowedEmail, signOut, updateMyName } from "../actions";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Pill } from "@/components/ui";
import PasswordForm from "@/components/PasswordForm";

export default function SettingsClient({
  myEmail,
  myName,
  team,
}: {
  myEmail: string;
  myName: string;
  team: { email: string; name: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(myName);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const run = (fn: () => Promise<{ error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      setError("");
      setOk("");
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        setOk(success);
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
      <Card>
        <CardHeader title="Equipe com acesso" subtitle="Só estes e-mails conseguem criar conta e entrar." />
        <ul className="divide-y divide-line">
          {team.map((t) => (
            <li key={t.email} className="flex items-center gap-3 px-4 py-3 lg:px-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-sm font-bold text-ink-2">
                {(t.name ?? t.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.name ?? "Ainda não fez o primeiro acesso"}</p>
                <p className="truncate text-[13px] text-ink-3">{t.email}</p>
              </div>
              {t.email === myEmail.toLowerCase() ? (
                <Pill>Você</Pill>
              ) : (
                <button
                  onClick={() => window.confirm(`Remover o acesso de ${t.email}?`) && run(() => removeAllowedEmail(t.email), "Acesso removido.")}
                  className="rounded-lg p-2 text-ink-3 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover acesso"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="space-y-2 border-t border-line p-4 lg:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addAllowedEmail(email), "E-mail liberado. A pessoa já pode usar “Primeiro acesso”.", () => setEmail(""));
          }}
        >
          <Field label="Liberar novo e-mail">
            <div className="flex gap-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              <Button variant="dark" disabled={pending || !email}>
                <UserPlus className="h-4 w-4" /> Liberar
              </Button>
            </div>
          </Field>
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Depois de liberado, a pessoa entra na tela de login em “Primeiro acesso” e cria a própria senha.
          </p>
        </form>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Minha conta" subtitle={myEmail} />
          <form
            className="space-y-3 p-4 lg:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateMyName(name), "Nome atualizado.");
            }}
          >
            <Field label="Seu nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button variant="dark" disabled={pending}>
              Salvar
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Trocar senha" subtitle="Esqueceu a senha? Na tela de login, use “Esqueci minha senha”." />
          <div className="p-4 lg:p-5">
            <PasswordForm />
          </div>
        </Card>

        {(error || ok) && (error ? <ErrorNote>{error}</ErrorNote> : <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">{ok}</p>)}

        <form action={signOut}>
          <Button variant="danger" className="w-full">
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </form>
      </div>
    </div>
  );
}
