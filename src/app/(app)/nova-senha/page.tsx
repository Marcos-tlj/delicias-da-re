import { requireStaff } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import PasswordForm from "@/components/PasswordForm";

export const metadata = { title: "Nova senha" };

/** Aberta pelo link de "Esqueci minha senha" (o link já faz o login). */
export default async function NewPasswordPage() {
  const { user } = await requireStaff();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Criar nova senha" subtitle={`Para ${user.email}. Depois de salvar, use a nova senha para entrar.`} />
      <Card className="p-5">
        <PasswordForm afterHref="/" />
      </Card>
    </div>
  );
}
