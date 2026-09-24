# Delícias da Rê — Gestão de pedidos (uso interno)

Sistema interno da confeitaria, só para a equipe (Marcos e a Rê). Funciona no computador e no celular.
**Stack:** Next.js 15 + TypeScript + Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime) · Vercel.
**No ar:** https://delicias-da-re.vercel.app

## O que faz
- **Início:** agenda de entregas (atrasados, hoje, amanhã, próximos dias), valor a receber, vendas do mês e o estoque de itens prontos.
- **Pedidos:** criar, editar, mudar o status (Novo → Confirmado → Em preparo → Pronto → Entregue, ou Cancelado), com data e hora de entrega ou retirada, endereço, taxa, desconto, sinal e pagamento, além de um botão de WhatsApp para o cliente.
- **Clientes:** cadastro com telefone, endereço e anotações, histórico de pedidos e total gasto. Um cliente novo também pode ser criado direto no pedido.
- **Produtos e estoque:** preço por unidade ou por kg, "a partir de", ativar/pausar e estoque dos itens prontos, com botões + e −. **Criar um pedido dá baixa no estoque sozinho. Cancelar, editar ou excluir o pedido devolve os itens.**
- **Sabores e opções:** listas de massas, recheios, coberturas e adicionais. Um sabor adicionado aparece na hora em todos os produtos que usam aquela lista. Um sabor em falta pode ser escondido sem ser apagado.
- **Configurações:** define quais e-mails podem entrar no sistema.
- **Tempo real:** quando uma pessoa altera algo, a tela da outra atualiza sozinha.

## Segurança
- **Só e-mails liberados** (tabela `allowed_emails`) conseguem criar conta: um trigger no banco recusa qualquer outro e-mail.
- **RLS em todas as tabelas:** sem acesso liberado, nada é lido nem gravado, mesmo por quem tenha a chave pública.
- Tirar um e-mail da lista corta o acesso na hora.
- Não há chave secreta no app. As variáveis ficam no `.env.local`, que não vai para o GitHub, e nas configurações da Vercel.

## Primeiro acesso
1. Acesse o site → **Primeiro acesso** → digite nome, e-mail liberado e uma senha (mínimo de 8 caracteres).
2. Para liberar outra pessoa: **Configurações → Liberar novo e-mail**. Depois ela usa "Primeiro acesso".

> No Supabase, "Confirm email" fica **desligado** (Authentication → Sign In / Providers → Email). Isso é seguro porque só e-mails da lista conseguem se cadastrar, e evita depender do envio de e-mails.

## Rodar localmente
```bash
npm install
npm run dev      # http://localhost:3000
```
O arquivo `.env.local` precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use a publishable key).

## Banco de dados
Script completo em `supabase/schema.sql`. **Atenção: ele apaga e recria as tabelas.** Use só para montar do zero.

## Estrutura
```
src/
├─ middleware.ts                 # exige login em todas as páginas
├─ lib/  supabase/ (client, server, middleware) · format.ts · types.ts · queries.ts
├─ components/  AppShell (menu), OrderForm, ItemDialog, OrderCard, StockStepper, ui.tsx
└─ app/
   ├─ login/                     # entrar / primeiro acesso
   └─ (app)/                     # área interna
      ├─ page.tsx                # início (agenda e indicadores)
      ├─ pedidos/  novo/  [id]/  [id]/editar/
      ├─ clientes/  [id]/
      ├─ produtos/  [id]/
      ├─ sabores/
      ├─ configuracoes/
      └─ actions.ts              # todas as gravações (server actions)
```
