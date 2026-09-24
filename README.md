# Delícias da Rê — Pedidos online

App de pedidos mobile-first (estilo iFood) para a confeitaria.
**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime, Storage) · Vercel.

## O que já vem pronto

**Cliente**
- Cardápio por categoria (Bolos, Doces, Tortas), busca, fotos, bottom sheet com escolhas (massa, recheio, adicionais), quantidade por unidade ou por kg.
- Sacola salva no aparelho (fechou o navegador, voltou, está lá).
- Login com Google ou por e-mail (link mágico **ou** código de 6 dígitos).
- Checkout: retirada/entrega (com busca de CEP), data desejada, PIX ou cartão na entrega. Nenhum pagamento acontece no site.
- Acompanhamento do pedido em tempo real, com chave PIX para copiar e botão de WhatsApp.

**Administração (`/admin`)**, só para quem tem `is_admin = true`
- Fila de pedidos em tempo real, com som (fica tocando a cada 20 s enquanto houver pedido não aceito, como no iFood), vibração e tela sempre acesa.
- Botões rápidos: Aceitar → Em preparo → Saiu para entrega / Pronto p/ retirada → Finalizar (e Recusar).
- Cardápio: criar e editar produtos, preços e fotos (comprimidas no próprio celular), opções de escolha e o botão de pausar.

## Como a segurança funciona

| Camada | O que faz |
|---|---|
| **RLS no Postgres** | O cliente só lê os **próprios** pedidos e itens. Nenhum cliente consegue inserir, editar ou apagar pedidos direto nas tabelas. Só admin altera status e produtos. |
| **Função `place_order`** | Pedidos só são criados por ela. O navegador envia apenas *id do produto + quantidade + opções*; **preço, disponibilidade e total são calculados no banco** (ninguém consegue "editar o preço" no navegador). Também valida opções, quantidade, endereço e limita a 3 pedidos a cada 10 min. |
| **Coluna `is_admin` travada** | Por permissão de coluna, o usuário só pode editar `full_name` e `phone` do próprio perfil. Virar admin só é possível pelo SQL Editor. |
| **Middleware + layout do admin + server actions** | Três checagens de `is_admin` antes de chegar ao banco, que ainda aplica o RLS. |
| **Variáveis de ambiente** | As chaves ficam em `.env.local` (fora do Git) e nas configurações da Vercel. O app usa **só a chave pública** (publishable/anon), que foi feita para ficar exposta; quem protege os dados é o RLS. **A `service_role` não é usada em lugar nenhum.** |

Todas essas regras foram testadas num Postgres local: cliente B não vê pedido do cliente A, cliente não muda status, não vira admin, não altera preço, e preço forjado é ignorado.

---

## Passo a passo

### 1. Supabase: criar o banco
1. Em [supabase.com](https://supabase.com), crie um projeto (região **South America (São Paulo)**).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. O script cria as tabelas, o RLS, a função de pedido, o Realtime, o bucket de fotos e o cardápio inicial.
3. Em **Project Settings → API** (ou **Data API / API Keys**), copie:
   - **Project URL**
   - **Publishable key** (ou "anon public")

### 2. Supabase: login
**Authentication → URL Configuration**
- *Site URL:* `http://localhost:3000` (troque pela URL da Vercel depois do deploy)
- *Redirect URLs:* adicione `http://localhost:3000/**` e `https://*.vercel.app/**` (e o seu domínio, se tiver)

**Login por e-mail (código + link)**
Em **Authentication → Emails → Magic Link**, troque o corpo por:
```html
<h2>Seu acesso à Delícias da Rê</h2>
<p>Seu código: <strong>{{ .Token }}</strong></p>
<p>Ou toque aqui: <a href="{{ .ConfirmationURL }}">Entrar</a></p>
```
O código é importante no celular: quando o cliente abre o link dentro do app do Gmail, o navegador é outro e o link falha. O código funciona sempre.

> ⚠️ **Importante:** o envio de e-mail padrão do Supabase só entrega para membros da sua equipe no Supabase e tem limite baixíssimo. Para clientes reais, configure um SMTP em **Authentication → Emails → SMTP Settings**. O [Resend](https://resend.com) tem plano grátis de 3.000 e-mails/mês. Enquanto isso, o **login com Google** atende todo mundo.

**Google**
1. No [Google Cloud Console](https://console.cloud.google.com): crie um projeto → **APIs e serviços → Tela de consentimento OAuth** (tipo Externo) → **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
2. Em *URIs de redirecionamento autorizados*, cole a callback que o Supabase mostra em **Authentication → Sign In / Providers → Google** (algo como `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
3. Copie o *Client ID* e o *Client Secret* para o provedor Google no Supabase e ative-o.

### 3. Rodar localmente
```bash
cd delicias-da-re
cp .env.example .env.local      # no Windows: copy .env.example .env.local
# edite .env.local com a URL e a chave do passo 1
npm install
npm run dev
```
Abra `http://localhost:3000`. Para testar no celular, use o IP do computador na mesma rede Wi-Fi (ex.: `http://192.168.0.10:3000`); nesse caso, adicione `http://192.168.0.10:3000/**` às Redirect URLs.

### 4. Tornar você e sua mãe administradoras
1. Cada uma entra no site uma vez (Google ou e-mail).
2. No **SQL Editor**, rode:
```sql
update public.profiles set is_admin = true
where email in ('seu-email@gmail.com', 'email-da-sua-mae@gmail.com');
```
3. Entre em **Conta → Painel da confeitaria** (ou `/admin`) e toque em **"ligar o som"**. Os navegadores só tocam som depois de um toque na tela.

### 5. GitHub + Vercel
```bash
git init && git add . && git commit -m "Delícias da Rê: primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/delicias-da-re.git
git push -u origin main
```
Na Vercel: **Add New → Project → importe o repositório** → em *Environment Variables* adicione as 4 variáveis do `.env.example` → **Deploy**.
Depois, volte ao Supabase e coloque a URL da Vercel em *Site URL*.

---

## Estrutura de pastas
```
delicias-da-re/
├─ supabase/schema.sql            # banco, RLS, função de pedido, seed
├─ src/
│  ├─ middleware.ts               # renova a sessão e protege rotas
│  ├─ lib/
│  │  ├─ supabase/{client,server,middleware}.ts
│  │  ├─ admin.ts                 # requireAdmin()
│  │  ├─ cart.tsx                 # sacola persistente (localStorage)
│  │  ├─ format.ts  types.ts
│  ├─ components/                 # BottomNav, MenuClient, ProductSheet, CartBar…
│  └─ app/
│     ├─ page.tsx                 # cardápio
│     ├─ carrinho/                # sacola
│     ├─ checkout/                # formulário + server action placeOrder
│     ├─ pedidos/ e pedidos/[id]/ # lista e acompanhamento em tempo real
│     ├─ conta/                   # perfil e sair
│     ├─ login/  auth/callback/   # Google, link mágico e código
│     └─ admin/                   # painel (pedidos, cardápio, actions)
```

## Dicas de uso no dia a dia
- **Painel no celular:** deixe `/admin` aberto e na tela. O painel pede para manter a tela acesa, mas o iPhone/Android corta o som quando o navegador vai para segundo plano. No Android, "Adicionar à tela inicial" deixa o painel com cara de app.
- **Pausar produto** (botão verde) esconde o item do cardápio na hora, sem apagar.
- **Taxa de entrega e adicionais** ficam "a combinar" pelo WhatsApp (botão pronto em cada pedido).
- **Chave PIX:** preencha `NEXT_PUBLIC_PIX_KEY`. Vazia, o cliente vê "enviaremos a chave pelo WhatsApp".

## Próximos passos possíveis
Notificação push para o painel com o celular bloqueado · taxa de entrega por bairro · PIX automático (Mercado Pago/Asaas) · relatório de vendas.
