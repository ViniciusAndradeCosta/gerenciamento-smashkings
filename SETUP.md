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
4. Deve aparecer "Success". Pronto — banco criado com as 2 unidades (João Monlevade e Bela Vista).
5. **Só para testar:** o `supabase/seed.sql` enche o sistema com fornecedores, insumos, produtos, compras e vendas **fictícios**. Use num projeto de teste — **não rode no banco que a hamburgueria vai usar**.

### 1.2b Já usa o sistema? (banco existente)
Rode o `schema.sql` atual no SQL Editor do projeto que vocês já usam. Ele é **idempotente**: cria só as tabelas/colunas que faltam (preparos, configurações, custo médio, categorias, IDs de Consumer/Goomer/iFood…), recria views e regras de segurança e **não apaga nenhum dado**. Depois de rodar:
- Abra **Table Editor → `perfis`** e confira quem é `admin`. Na versão anterior, **todo mundo que criava conta virava admin** — rebaixe quem não deveria ter acesso total (veja "Como liberar o acesso" abaixo).
- Se você criou à mão algum trigger próprio para calcular o custo médio, remova-o: o `aplicar_compra` do schema já atualiza o CMP do insumo e o estoque da unidade.

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
   - **Opcional (IA):** para o assistente responder em linguagem livre e para a
     leitura de nota fiscal, crie uma chave grátis em https://aistudio.google.com/app/apikey
     e adicione `GEMINI_API_KEY=sua-chave`. Sem ela, o chat funciona em modo local
     (responde as perguntas comuns direto do banco) e a aba "Nota Fiscal (IA)" avisa
     que a chave não está configurada.
3. No terminal:
   ```
   npm install
   npm run dev
   ```
4. Abra http://localhost:3000 no navegador.
5. Clique em **"Criar agora"**, cadastre seu e-mail e senha → a primeira conta entra como **admin**.
6. Teste: vá em **Compras**, registre uma compra → volte ao **Estoque** e veja a quantidade e o CMP atualizados automaticamente. 🎉

---

## Parte 3 — Colocar no ar (Vercel)

Você já tem GitHub e Vercel.

1. O código fica no repositório **público** do GitHub. No plano grátis (Hobby) da
   Vercel, repositório privado só publica commits do dono da conta; sendo público,
   os commits do Vinicius e da Laura publicam normalmente.
   > ⚠️ Como o repositório é público, **nunca** faça commit de `.env.local`, chaves do
   > Supabase ou do Gemini — elas ficam só nas Environment Variables da Vercel (o
   > `.gitignore` já ignora os arquivos `.env*.local`).
2. Acesse https://vercel.com/new → **Import** do repositório.
3. Em **Environment Variables**, adicione as chaves:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (opcional — chat com IA e leitura de nota fiscal)
4. Clique em **Deploy**. Em ~1 min você recebe o link `https://smashkings.vercel.app`.

> Use sempre a chave **anon public**. A chave `service_role` ignora todas as regras de segurança e **nunca** deve ir para a Vercel nem para o código.

### Ajuste final no Supabase (para login funcionar no ar)
1. Supabase → **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o link da Vercel (`https://smashkings.vercel.app`).
3. Em **Redirect URLs**, adicione o mesmo link (o e-mail de confirmação de conta volta para ele).
4. Salve.

### Criar as contas e fechar o cadastro
1. Abra o link da Vercel e crie **a sua** conta primeiro — a primeira conta do sistema vira **admin**.
2. Peça para os gerentes criarem as contas deles. Elas entram como **pendentes** (veem só um aviso de "acesso pendente") até você liberar — veja "Como liberar o acesso" abaixo.
3. Quando todo mundo tiver conta, desligue novos cadastros: Supabase → **Authentication** → **Sign In / Providers** → desmarque **Allow new users to sign up**. (Mesmo ligado, quem se cadastrar não vê nada sem liberação — mas fechar evita contas estranhas.)

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

**"Como liberar o acesso de alguém?"**
Supabase → **Table Editor** → tabela `perfis` → ache a pessoa pelo nome e edite o `papel`:
- `gerente` + `unidade_id` da unidade dele (copie o `id` da tabela `unidades`) → vê e lança só naquela unidade;
- `admin` → vê e edita todas as unidades;
- `pendente` → sem acesso (é como toda conta nova começa).

A pessoa precisa sair e entrar de novo para ver a mudança.

**"Os dados são de exemplo?"**
Só se você rodar o `seed.sql`, que é para testes. O banco de produção deve receber apenas o `schema.sql` — aí o sistema começa vazio, com as duas unidades, e vai se enchendo com as compras, produtos e fichas que vocês cadastrarem.

**"Por que o faturamento e o CMV aparecem zerados?"**
Eles dependem das **vendas**, e ainda não existe tela nem integração para lançá-las (veja "Próximos passos" no README). Estoque, compras, custos, fichas e preparos funcionam normalmente.

**"Como funciona o assistente (chat)?"**
No **botão flutuante 🍔** (canto inferior direito, em qualquer tela), é só perguntar em português — *"quanto vendi hoje?"*, *"qual o
CMV do mês?"*, *"o que está acabando no estoque?"*, *"compare as unidades"*. Ele responde
com os números reais do seu banco (respeitando o que cada usuário pode ver). Com a
`GEMINI_API_KEY` configurada, entende perguntas soltas via IA (Google Gemini, grátis);
sem a chave, funciona em **modo local** — reconhece as perguntas mais comuns e responde
direto do Supabase, sem enviar nada para fora e sem custo.
