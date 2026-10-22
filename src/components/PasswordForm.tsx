"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { changePassword } from "@/app/(app)/actions";
import { Button, ErrorNote, Field, Input } from "./ui";

/** Criar/trocar a senha de quem está logado. `afterHref`: para onde ir depois de salvar. */
export default function PasswordForm({ afterHref }: { afterHref?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone(false);
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As duas senhas não são iguais.");
    start(async () => {
      const r = await changePassword(password);
      if (r.error) return setError(r.error);
      setPassword("");
      setConfirm("");
      setDone(true);
      if (afterHref) setTimeout(() => router.replace(afterHref), 1200);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nova senha" hint="Mínimo de 8 caracteres. Misture letras e números.">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-ink-3 hover:text-ink"
            aria-label={show ? "Esconder senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <Field label="Repita a nova senha">
        <Input type={show ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Senha trocada. Use a nova senha no próximo login.
        </p>
      )}
      <Button variant="dark" size="lg" className="w-full" disabled={pending}>
        <KeyRound className="h-4 w-4" />
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
