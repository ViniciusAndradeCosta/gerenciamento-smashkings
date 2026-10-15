# 🍔 SmashKings — Sistema de Gestão

Sistema web **mobile-first** e **instalável no celular** (PWA) para gestão das duas unidades da SmashKings: estoque, compras, CMV, fichas técnicas e comparativo entre unidades.

**Stack:** Next.js 15 (App Router) · React 19 · Supabase (Postgres + Auth + RLS) · deploy na Vercel.

## Como o sistema funciona

- **Multi-unidade:** Centro (U1) e Norte (U2), com visão separada e consolidada.
- **CMP automático:** cada compra recalcula o Custo Médio Ponderado do ingrediente e soma ao estoque da unidade (trigger no banco).
- **Preparos:** molhos e sub-receitas montados a partir dos insumos; o custo por kg/L entra automaticamente nas fichas dos lanches.
- **CMV:** calculado a partir das vendas × custo da ficha técnica de cada produto (a mesma conta nas Fichas, no dashboard e no chat).
- **Alertas:** itens abaixo do estoque mínimo aparecem no dashboard.
- **Nota fiscal com IA:** foto ou PDF da nota → o Gemini lê os itens → você revisa e lança tudo como compra.
- **Assistente (chat):** um **botão flutuante 🍔** em todas as telas abre um chat onde você pergunta em linguagem natural ("quanto vendi hoje?", "qual o CMV do mês?", "o que está acabando?") e o sistema responde com os números reais. Usa o Google Gemini (grátis); sem a chave configurada, cai num modo local que responde as perguntas comuns direto do banco.
- **Login:** autenticação por e-mail/senha (Supabase Auth). As contas são criadas pelo painel do Supabase (a tela do sistema só tem "Entrar"). A **primeira** conta vira admin; as seguintes ficam **pendentes** (sem ver nada) até um admin liberar.
- **RLS:** gerente de unidade só enxerga a própria; admin vê tudo. As regras ficam no banco, não só na tela.

## Rodar em 4 passos

Veja o guia detalhado em **SETUP.md**. Resumo:

1. Crie um projeto no Supabase e rode `supabase/schema.sql` no SQL Editor (o `seed.sql` é só para testes — não rode no banco de produção).
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e, se quiser o chat e a leitura de nota com IA, a `GEMINI_API_KEY`).
3. `npm install && npm run dev` → abra http://localhost:3000
4. Crie a conta no Supabase (Authentication → Users → Add user, com "Auto Confirm User") — a primeira vira admin — e entre no sistema.

> **Já tem um banco em uso?** Rode o `schema.sql` atual mesmo assim: ele é idempotente, só cria o que falta e atualiza as regras de segurança, sem apagar dados. Detalhes no SETUP.md.

## Estrutura

```
app/            telas (dashboard, estoque, compras, cmv, comparativo, produtos, fichas, preparos, login)
app/api/        extrair-nf — leitura de nota fiscal com o Gemini
app/chat/       actions.ts — Server Action do assistente (resumo do banco + Gemini)
components/     AppNav, TopBar, UnitSwitcher, CompraForm, ImportarNotaForm, ChatWidget (botão 🍔), ChatAssistente, SW
lib/supabase/   clientes Supabase (browser, server, middleware)
supabase/       schema.sql (banco, idempotente) + seed.sql (dados de exemplo, só para teste)
public/         PWA (manifest, service worker, ícone)
```

## Próximos passos sugeridos

- **Vendas:** ainda não há tela nem integração para lançar vendas. Sem vendas, o faturamento e o CMV do dashboard ficam zerados. Próximo passo natural: importar os relatórios do Consumer, Goomer e iFood (os produtos já têm os campos de ID de cada um).
- Baixa automática do estoque pelas vendas (hoje o estoque sobe com as compras e é ajustado à mão na contagem)
- CMP separado por unidade no CMV (hoje as duas unidades usam o mesmo custo de ficha)
- ~~Cadastro de ingredientes/fichas pela interface~~ ✅ feito
- ~~Leitura real de nota fiscal com IA~~ ✅ feito
- ~~Assistente IA conectado aos dados reais~~ ✅ feito (botão flutuante 🍔)
