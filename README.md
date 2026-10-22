# Delícias da Rê — Pedidos, estoque e lucro (uso interno)

Sistema interno da confeitaria, só para a equipe (Marcos e a Rê). Funciona no computador e no celular.
**Stack:** Next.js 15 + TypeScript + Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime) · Vercel.
**Região:** banco (Supabase `sa-east-1`) e servidor (Vercel `gru1`, definido em `vercel.json`) ficam em São Paulo. Mantenha os dois juntos: cada consulta ao banco atravessa essa distância.
**No ar:** https://delicias-da-re.vercel.app

## O que faz
- **Início:** agenda de entregas (atrasados, hoje, amanhã, próximos dias), valor a receber, vendas do mês e o estoque de itens prontos.
- **Pedidos:** criar, editar, mudar o status (Novo → Confirmado → Em preparo → Pronto → Entregue, ou Cancelado), com data e hora de entrega ou retirada, endereço, taxa, desconto, sinal e pagamento, além de um botão de WhatsApp para o cliente.
- **Clientes:** cadastro com telefone, endereço e anotações, histórico de pedidos e total gasto. Um cliente novo também pode ser criado direto no pedido.
- **Vendas e lucro:** relatório **semanal** (últimas 8 semanas) e **mensal** (últimos 6 meses) com gráfico de rendimento bruto, gastos e lucro final. Mostra também a margem real, o ticket médio, a comparação com o período anterior, para onde foi o dinheiro, os produtos que mais lucraram e a lista de vendas e despesas do período.
- **Venda rápida:** registra uma venda no balcão em poucos toques. Ela já sai paga e entregue e dá baixa no estoque.
- **Despesas:** gás, embalagens, entregas e outros gastos que não estão no custo de cada produto entram nos gastos do relatório.
- **Ingredientes e embalagens:** cadastro do que foi comprado (ingrediente, embalagem ou outro): nome, quanto vem no pacote (g, kg, ml, L ou un) e o preço pago. Ex.: 50 caixinhas por R$ 30 → R$ 0,60 cada. O sistema mostra quanto sai o kg, o litro ou a unidade. **Mudou o preço numa compra nova? Edite o ingrediente: o custo de todos os produtos que o usam é recalculado na hora (e o preço também, se o produto usa o preço sugerido).**
- **Receita do produto:** em cada produto, escolha os ingredientes e quanto usou de cada um (pode ser em outra medida: comprou em kg e usa em g) e diga quanto a receita rende. Embalagens são informadas **por unidade vendida** (1 caixinha, 2 forminhas…). Custo de 1 unidade = ingredientes ÷ rendimento + embalagens + outros custos digitados (gás, mão de obra…).
- **Custo do bolo pelo peso e pelos sabores:** em **Sabores**, cada sabor (massa, recheio, adicional) pode ter a própria receita e "para quantos kg de bolo ela dá"; o sistema calcula o custo do sabor por kg. Em cada pedido, o custo do item = (custo do produto por kg + custo dos sabores escolhidos por kg, com média nas camadas) × peso + embalagens do bolo (caixa, cartão… uma vez por bolo, não multiplicam pelo peso). Em cada item do pedido há o campo **"Quanto você gastou neste item"**: o valor digitado ali vale para aquele bolo (o tamanho e o preço dos ingredientes variam). Se ficar vazio, usa o cálculo do cadastro como sugestão. O relatório de lucro usa esse custo.
- **Senha:** "Esqueci minha senha" na tela de login envia um link por e-mail que abre a tela de nova senha (abra no mesmo aparelho e navegador). Logado, dá para trocar a senha em **Configurações**.
- **Bolo sob encomenda com camadas de recheio:** o produto tem 2 camadas (padrão) e cada uma escolhe um sabor de qualquer lista ligada a ele (ex.: Recheios tradicionais e especiais). O preço do kg é a **média das camadas**: 1 tradicional (R$ 65) + 1 especial (R$ 80) = R$ 72,50/kg. O preço do kg de cada lista fica em **Sabores**. No pedido dá para mudar o número de camadas (bolo de andares, personalizado) e digitar outro preço.
- **Custo e preço:** cada produto tem o custo de produção, que vem da receita ou pode ser digitado direto, e uma porcentagem de lucro. O sistema calcula o preço sugerido **sobre o custo** (custo + %) ou **sobre a venda** (o lucro vira % do preço), com arredondamento opcional. Dá para usar o preço sugerido ou definir outro e ver a margem real.
- **Produtos e estoque:** preço por unidade ou por kg, "a partir de", ativar/pausar e estoque dos itens prontos, com botões + e −. **Criar um pedido dá baixa no estoque sozinho. Cancelar, editar ou excluir o pedido devolve os itens.**
- **Sabores e opções:** listas de massas, recheios, coberturas e adicionais. Um sabor adicionado aparece na hora em todos os produtos que usam aquela lista. Um sabor em falta pode ser escondido sem ser apagado.
- **Configurações:** define quais e-mails podem entrar no sistema.
- **Tempo real:** quando uma pessoa altera algo, a tela da outra atualiza sozinha.

## Segurança
- **Só e-mails liberados** (tabela `allowed_emails`) conseguem criar conta: um trigger no banco recusa qualquer outro e-mail.
- **RLS em todas as tabelas:** sem acesso liberado, nada é lido nem gravado, mesmo por quem tenha a chave pública.
- Tirar um e-mail da lista corta o acesso na hora.
- Visitantes anônimos não recebem permissão automática em tabelas ou funções novas (migração `005`). Toda função nova precisa de `grant execute … to authenticated` explícito.
- Não há chave secreta no app. As variáveis ficam no `.env.local`, que não vai para o GitHub, e nas configurações da Vercel.

## Primeiro acesso
1. Acesse o site → **Primeiro acesso** → digite nome, e-mail liberado e uma senha (mínimo de 8 caracteres). Chega um e-mail de confirmação: abra o link **no mesmo aparelho e navegador** e você entra direto.
2. Para liberar outra pessoa: **Configurações → Liberar novo e-mail**. Depois ela usa "Primeiro acesso".

> No Supabase, "Confirm email" fica **ligado** (Authentication → Sign In / Providers): além de o e-mail precisar estar liberado, a pessoa prova que é dona dele. Em Authentication → URL Configuration, a Site URL é `https://delicias-da-re.vercel.app` e as Redirect URLs incluem `https://delicias-da-re.vercel.app/**`.

## Rodar localmente
```bash
npm install
npm run dev      # http://localhost:3000
```
O arquivo `.env.local` precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use a publishable key).

## Banco de dados
- **Atualizar um banco que já está em uso:** rode no SQL Editor do Supabase as migrações que ainda não rodou, em ordem (`002_financeiro.sql`, `003_permissoes_funcoes.sql`, `004_ingredientes.sql`, `005_camadas_embalagens_seguranca.sql`, `006_custo_sabores.sql`). Elas não apagam nada e podem ser rodadas mais de uma vez.
- **Montar do zero:** `supabase/schema.sql`. **Atenção: ele apaga e recria as tabelas.**

### Como o lucro é calculado
- **Rendimento bruto:** total dos pedidos não cancelados, contados pela data de entrega (ou pela data de criação, se não tiver data).
- **Gastos:** custo de produção dos itens vendidos + despesas lançadas. O custo de cada item é calculado no momento da venda (produto + sabores escolhidos × peso + embalagens do bolo) e fica gravado: mudar preços depois não altera vendas antigas. Ao editar um pedido, só os itens alterados recalculam o custo. Pedidos feitos antes da atualização usam o custo atual do produto como estimativa.
- **Lucro final:** rendimento bruto − gastos.

## Estrutura
```
src/
├─ middleware.ts                 # exige login em todas as páginas
├─ lib/  supabase/ (client, server, middleware) · format.ts · types.ts · queries.ts · pricing.ts · ingredients.ts · layers.ts · report.ts
├─ components/  AppShell (menu), OrderForm, ItemDialog, OrderCard, StockStepper, Charts, IngredientForm, Sheet, ui.tsx
└─ app/
   ├─ login/                     # entrar / primeiro acesso
   └─ (app)/                     # área interna
      ├─ page.tsx                # início (agenda e indicadores)
      ├─ pedidos/  novo/  [id]/  [id]/editar/
      ├─ vendas/  rapida/        # relatórios, despesas e venda rápida
      ├─ clientes/  [id]/
      ├─ produtos/  [id]/          # inclui a receita (ingredientes usados)
      ├─ ingredientes/            # ingredientes comprados e preço pago
      ├─ sabores/
      ├─ configuracoes/
      └─ actions.ts              # todas as gravações (server actions)
```
