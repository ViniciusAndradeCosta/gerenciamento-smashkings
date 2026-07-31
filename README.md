# 🍔 SmashKings — Sistema de Gestão

Sistema web **mobile-first** e **instalável no celular** (PWA) para gestão das duas unidades da SmashKings: estoque, compras, CMV, fichas técnicas e comparativo entre unidades.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres + Auth + RLS) · deploy na Vercel.

## Como o sistema funciona

- **Multi-unidade:** Centro (U1) e Norte (U2), com visão separada e consolidada.
- **CMP automático:** cada compra recalcula o Custo Médio Ponderado do ingrediente e soma ao estoque da unidade (trigger no banco).
- **CMV:** calculado a partir das vendas × custo da ficha técnica de cada produto.
- **Alertas:** itens abaixo do estoque mínimo aparecem no dashboard.
- **Assistente (chat):** um **botão flutuante 🍔** em todas as telas abre um chat onde você pergunta em linguagem natural ("quanto vendi hoje?", "qual o CMV do mês?", "o que está acabando?") e o sistema responde com os números reais. Usa o Google Gemini (grátis); sem a chave configurada, cai num modo local que responde as perguntas comuns direto do banco.
- **Login:** autenticação por e-mail/senha (Supabase Auth). O primeiro usuário vira admin (vê todas as unidades).
- **RLS:** gerente de unidade só enxerga a própria; admin vê tudo.

## Rodar em 4 passos

Veja o guia detalhado em **SETUP.md**. Resumo:

1. Crie um projeto no Supabase e rode `supabase/schema.sql` e depois `supabase/seed.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e, se quiser o chat com IA, a `GEMINI_API_KEY` — opcional e grátis).
3. `npm install && npm run dev` → abra http://localhost:3000
4. Crie sua conta na tela de login e comece a usar.

## Estrutura

```
app/            telas (dashboard, estoque, compras, cmv, comparativo, fichas, login)
app/chat/       actions.ts — Server Action do assistente (resumo do banco + Gemini)
components/     Header, BottomNav, UnitSwitcher, CompraForm, ChatWidget (botão 🍔), ChatAssistente, SW
lib/supabase/   clientes Supabase (browser, server, middleware)
supabase/       schema.sql (banco) + seed.sql (dados de exemplo)
public/         PWA (manifest, service worker, ícone)
```

## Próximos passos sugeridos

- Cadastro de ingredientes/fichas pela interface (hoje via seed)
- Leitura real de nota fiscal com IA (OCR)
- Integração com PDV/delivery para importar vendas automaticamente
- ~~Assistente IA conectado aos dados reais~~ ✅ feito (botão flutuante 🍔)
