# 🚀 SmashKings — Guia de instalação (passo a passo)

Sem pressa — cada passo tem prints do que clicar. Leva ~15 minutos.

---

## Parte 1 — Criar o banco de dados (Supabase)

### 1.1 Criar conta e projeto
1. Acesse https://supabase.com → **Start your project** → entre com o GitHub.
2. Clique em **New project**.
3. Preencha:
   - **Name:** smashkings
   - **Database Password:** crie uma senha forte e **guarde** (você vai precisar).
   - **Region:** South America (São Paulo) — mais rápido no Brasil.
4. Clique em **Create new project** e aguarde ~2 min.

### 1.2 Rodar o banco
1. No menu lateral, abra **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/schema.sql`, copie **todo** o conteúdo, cole e clique em **Run**.
4. Faça o mesmo com `supabase/seed.sql` (dados de exemplo). Rode **depois** do schema.
5. Deve aparecer "Success". Pronto — banco criado com as 2 unidades e ingredientes.

### 1.3 Pegar as chaves de conexão
1. Menu lateral → **Project Settings** (engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** (ex: `https://abcdxyz.supabase.co`)
   - **anon public** key (uma chave longa)

---

## Parte 2 — Rodar o sistema no seu computador (teste)

> Precisa ter o **Node.js** instalado: https://nodejs.org (versão LTS).

1. Abra a pasta `smashkings` no terminal.
2. Crie o arquivo de ambiente:
   - Copie `.env.example` para `.env.local`
   - Preencha com as chaves do passo 1.3:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
     ```
   - **Opcional (chat com IA):** para o assistente responder em linguagem livre,
     crie uma chave grátis em https://aistudio.google.com/app/apikey e adicione
     `GEMINI_API_KEY=sua-chave`. Sem ela, o chat funciona em modo local (responde
     as perguntas comuns direto do banco).
3. No terminal:
   ```
   npm install
   npm run dev
   ```
4. Abra http://localhost:3000 no navegador.
5. Clique em **"Criar agora"**, cadastre seu e-mail e senha → você entra como **admin**.
6. Teste: vá em **Compras**, registre uma compra → volte ao **Estoque** e veja a quantidade e o CMP atualizados automaticamente. 🎉

---

## Parte 3 — Colocar no ar (Vercel)

Você já tem GitHub e Vercel.

1. Suba a pasta `smashkings` num repositório no GitHub
   (https://github.com/new → "uploading an existing file" → arraste os arquivos).
2. Acesse https://vercel.com/new → **Import** do repositório.
3. Em **Environment Variables**, adicione as chaves:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (opcional — só para o chat com IA)
4. Clique em **Deploy**. Em ~1 min você recebe o link `https://smashkings.vercel.app`.

### Ajuste final no Supabase (para login funcionar no ar)
1. Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o link da Vercel (`https://smashkings.vercel.app`).
3. Salve.

---

## Parte 4 — Instalar no celular

1. Abra o link da Vercel no **Chrome (Android)** ou **Safari (iPhone)**.
2. **Android:** menu (⋮) → **Instalar app** / **Adicionar à tela inicial**.
3. **iPhone:** Compartilhar (□↑) → **Adicionar à Tela de Início**.
4. O ícone 🍔 aparece na tela e abre em tela cheia, como app nativo.

---

## Dúvidas comuns

**"Preciso confirmar e-mail ao criar conta?"**
Por padrão o Supabase pede confirmação por e-mail. Para testar mais rápido:
Supabase → Authentication → Providers → Email → desligue **"Confirm email"**.

**"Como transformar alguém em gerente de uma unidade só?"**
Supabase → Table Editor → tabela `perfis` → edite o `papel` para `gerente` e defina o `unidade_id` da unidade dele. Deixe `unidade_id` vazio para admin (vê tudo).

**"Os dados são de exemplo?"**
O `seed.sql` cria dados iniciais para você ver o sistema cheio. Pode apagar quando começar a usar de verdade, ou simplesmente registrar suas compras/vendas por cima.

**"Como funciona o assistente (chat)?"**
No **botão flutuante 🍔** (canto inferior direito, em qualquer tela), é só perguntar em português — *"quanto vendi hoje?"*, *"qual o
CMV do mês?"*, *"o que está acabando no estoque?"*, *"compare as unidades"*. Ele responde
com os números reais do seu banco (respeitando o que cada usuário pode ver). Com a
`GEMINI_API_KEY` configurada, entende perguntas soltas via IA (Google Gemini, grátis);
sem a chave, funciona em **modo local** — reconhece as perguntas mais comuns e responde
direto do Supabase, sem enviar nada para fora e sem custo.
