-- ============================================================
-- SmashKings — Schema do banco (Supabase / PostgreSQL)
-- Multi-unidade · CMP (Custo Médio Ponderado) e CMV automáticos
--
-- Rode inteiro no Supabase: SQL Editor > New query > Run
--
-- O script é IDEMPOTENTE: pode rodar num projeto novo ou num banco que já
-- está em uso. Ele só cria o que falta (tabelas, colunas, índices) e
-- recria funções, views e políticas de segurança — nenhum dado é apagado.
-- ============================================================
create extension if not exists "uuid-ossp";

-- 1. UNIDADES
create table if not exists unidades (
  id        uuid primary key default uuid_generate_v4(),
  nome      text not null,
  codigo    text not null unique,
  cor       text default '#e63946',
  ativo     boolean default true,
  criado_em timestamptz default now()
);
-- Garante as colunas usadas pelo app mesmo em tabelas alteradas à mão
alter table unidades add column if not exists cor text default '#e63946';
alter table unidades add column if not exists ativo boolean default true;

-- 2. PERFIS (liga auth.users a unidade e papel)
--    papel: 'admin'    → vê e edita todas as unidades
--           'gerente'  → só a unidade de unidade_id
--           'pendente' → conta criada, aguardando um admin liberar (sem acesso)
create table if not exists perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  papel      text not null default 'pendente',
  unidade_id uuid references unidades(id),
  criado_em  timestamptz default now()
);
alter table perfis alter column papel set default 'pendente';

-- Antes, "unidade_id vazio" significava admin. Quem já tinha esse acesso
-- continua admin, agora de forma explícita pelo papel.
update perfis set papel = 'admin' where papel = 'gerente' and unidade_id is null;

-- O primeiro usuário vira admin. Os seguintes entram como 'pendente' até um
-- admin definir o papel/unidade deles na tabela perfis.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    case when exists (select 1 from public.perfis where papel = 'admin') then 'pendente' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- 3. FORNECEDORES
create table if not exists fornecedores (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, telefone text, criado_em timestamptz default now()
);

-- 4. INGREDIENTES (compartilhado entre as unidades)
--    Também guarda os preparos/sub-receitas (molhos etc.), marcados com
--    e_produzido_internamente = true e montados em preparo_itens.
create table if not exists ingredientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  unidade_medida text not null default 'un',
  categoria text, ativo boolean default true, criado_em timestamptz default now()
);
alter table ingredientes add column if not exists ativo boolean default true;
alter table ingredientes add column if not exists custo_medio numeric(14,4) not null default 0;   -- CMP global (trigger de compras)
alter table ingredientes add column if not exists estoque_minimo numeric(14,3) not null default 0;
alter table ingredientes add column if not exists e_produzido_internamente boolean not null default false;
alter table ingredientes add column if not exists rendimento_receita numeric(14,3) not null default 1; -- preparos: rendimento do lote
alter table ingredientes add column if not exists custo_fixo numeric(14,2);                         -- preparos: custo fixo do lote

-- 5. ESTOQUE POR UNIDADE (quantidade + CMP da unidade)
create table if not exists estoque (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references unidades(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete cascade,
  quantidade numeric(14,3) not null default 0,
  custo_medio numeric(14,4) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  atualizado_em timestamptz default now(),
  unique (unidade_id, ingrediente_id)
);
alter table estoque add column if not exists custo_medio numeric(14,4) not null default 0;
alter table estoque add column if not exists estoque_minimo numeric(14,3) not null default 0;
alter table estoque add column if not exists atualizado_em timestamptz default now();

-- 6. COMPRAS (recalcula CMP e soma ao estoque)
create table if not exists compras (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references unidades(id),
  ingrediente_id uuid not null references ingredientes(id),
  fornecedor_id uuid references fornecedores(id),
  quantidade numeric(14,3) not null,
  preco_unitario numeric(14,4) not null,
  total numeric(14,2) generated always as (quantidade * preco_unitario) stored,
  data_compra date not null default current_date,
  origem text default 'manual',
  criado_em timestamptz default now()
);
alter table compras add column if not exists origem text default 'manual';
-- "Hoje" no fuso da operação: o banco roda em UTC e, depois das 21h,
-- current_date já seria o dia seguinte.
alter table compras add column if not exists data_compra date not null default current_date;
alter table compras alter column data_compra set default ((now() at time zone 'America/Sao_Paulo')::date);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compras_valores_validos') then
    -- not valid: vale para os lançamentos novos sem barrar dados antigos
    alter table compras add constraint compras_valores_validos
      check (quantidade > 0 and preco_unitario >= 0) not valid;
  end if;
end $$;

-- CMP = (q_atual*c_atual + q_compra*preco) / (q_atual + q_compra)
-- Atualiza o CMP global do ingrediente (usado em fichas, estoque e CMV) e o
-- estoque/CMP da unidade que comprou. Se não havia saldo ou custo conhecido,
-- o CMP passa a ser o preço da compra (não "dilui" com estoque de custo zero).
create or replace function public.aplicar_compra()
returns trigger language plpgsql security definer set search_path = public as $$
declare q_total numeric; c_global numeric;
begin
  select coalesce(sum(greatest(quantidade, 0)), 0) into q_total
    from estoque where ingrediente_id = new.ingrediente_id;
  select coalesce(custo_medio, 0) into c_global
    from ingredientes where id = new.ingrediente_id for update;

  update ingredientes set custo_medio =
    case when q_total > 0 and c_global > 0
         then (q_total * c_global + new.quantidade * new.preco_unitario) / (q_total + new.quantidade)
         else new.preco_unitario end
  where id = new.ingrediente_id;

  update estoque set
    quantidade = quantidade + new.quantidade,
    custo_medio = case when quantidade > 0 and custo_medio > 0
                       then (quantidade * custo_medio + new.quantidade * new.preco_unitario) / (quantidade + new.quantidade)
                       else new.preco_unitario end,
    atualizado_em = now()
  where unidade_id = new.unidade_id and ingrediente_id = new.ingrediente_id;
  if not found then
    insert into estoque (unidade_id, ingrediente_id, quantidade, custo_medio)
    values (new.unidade_id, new.ingrediente_id, new.quantidade, new.preco_unitario);
  end if;
  return new;
end; $$;
drop trigger if exists trg_aplicar_compra on compras;
create trigger trg_aplicar_compra after insert on compras
  for each row execute function public.aplicar_compra();

-- 7. PRODUTOS E FICHAS TÉCNICAS
create table if not exists produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  preco_venda numeric(14,2) not null default 0,
  custo_fixo numeric(14,2),
  ativo boolean default true, criado_em timestamptz default now()
);
alter table produtos add column if not exists ativo boolean default true;
alter table produtos add column if not exists custo_fixo numeric(14,2);
alter table produtos add column if not exists categoria text;
alter table produtos add column if not exists id_consumer text;  -- código no PDV Consumer
alter table produtos add column if not exists id_goomer text;    -- código no Goomer
alter table produtos add column if not exists id_ifood text;     -- código no iFood

-- O custo fixo já teve outros nomes (custo_extra, custo_salao). Se o banco
-- ainda tiver essas colunas, copia o valor para custo_fixo, que é o que o app usa.
do $$ declare r record; begin
  for r in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ('produtos', 'ingredientes')
      and column_name in ('custo_extra', 'custo_salao')
  loop
    execute format('update public.%I set custo_fixo = %I where custo_fixo is null and %I is not null',
                   r.table_name, r.column_name, r.column_name);
  end loop;
end $$;

create table if not exists ficha_itens (
  id uuid primary key default uuid_generate_v4(),
  produto_id uuid not null references produtos(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id),
  quantidade numeric(14,3) not null
);

-- 8. PREPAROS (sub-receitas: molhos etc. feitos a partir de insumos brutos)
create table if not exists preparo_itens (
  id uuid primary key default uuid_generate_v4(),
  insumo_pai_id uuid not null references ingredientes(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id) on delete cascade,
  quantidade numeric(14,3) not null,
  criado_em timestamptz default now()
);

-- 9. CONFIGURAÇÕES (custo fixo padrão aplicado a produtos e preparos)
create table if not exists configuracoes_loja (
  id uuid primary key default uuid_generate_v4(),
  custo_fixo_padrao numeric(14,2) not null default 1.50,
  updated_at timestamptz default now()
);
alter table configuracoes_loja add column if not exists custo_fixo_padrao numeric(14,2) not null default 1.50;
alter table configuracoes_loja add column if not exists updated_at timestamptz default now();

-- 10. VENDAS
create table if not exists vendas (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references unidades(id),
  produto_id uuid references produtos(id),
  quantidade integer not null default 1,
  valor_total numeric(14,2) not null,
  data_venda date not null default current_date,
  criado_em timestamptz default now()
);
alter table vendas add column if not exists data_venda date not null default current_date;
alter table vendas alter column data_venda set default ((now() at time zone 'America/Sao_Paulo')::date);

-- Índices das consultas mais comuns (dashboard, CMV, fichas)
create index if not exists idx_vendas_unidade_data on vendas (unidade_id, data_venda);
create index if not exists idx_compras_unidade_data on compras (unidade_id, data_compra);
create index if not exists idx_estoque_ingrediente on estoque (ingrediente_id);
create index if not exists idx_ficha_itens_produto on ficha_itens (produto_id);
create index if not exists idx_preparo_itens_pai on preparo_itens (insumo_pai_id);

-- Preenche o CMP global e o mínimo de quem ainda não tem, a partir do
-- estoque das unidades (bancos criados com a versão anterior do schema).
update ingredientes i set custo_medio = s.cmp
from (
  select ingrediente_id, sum(quantidade * custo_medio) / sum(quantidade) as cmp
  from estoque where quantidade > 0 and custo_medio > 0 group by ingrediente_id
) s
where s.ingrediente_id = i.id and coalesce(i.custo_medio, 0) = 0;

update ingredientes i set estoque_minimo = s.minimo
from (select ingrediente_id, max(estoque_minimo) as minimo from estoque group by ingrediente_id) s
where s.ingrediente_id = i.id and coalesce(i.estoque_minimo, 0) = 0 and s.minimo > 0;

-- 11. VIEWS
-- security_invoker: a view respeita o RLS de quem consulta (sem isso, um
-- gerente enxergaria os números de todas as unidades por meio das views).
drop view if exists v_custo_produto;
drop view if exists v_valor_estoque;
drop view if exists v_alertas_estoque;
drop view if exists v_custo_ingrediente;

-- Mais casas decimais nas quantidades: com a digitação em gramas, receitas
-- usam frações pequenas de kg (0,4 g de sal = 0,0004 kg). Só aumenta a
-- precisão; precisa rodar com as views removidas (elas usam essas colunas).
do $$ declare r record; begin
  for r in select * from (values
      ('ficha_itens', 'quantidade', 16, 6),
      ('preparo_itens', 'quantidade', 16, 6),
      ('estoque', 'quantidade', 16, 4),
      ('estoque', 'estoque_minimo', 16, 4),
      ('ingredientes', 'estoque_minimo', 16, 4)
    ) as v(tabela, coluna, prec, escala)
  loop
    if exists (select 1 from information_schema.columns c
               where c.table_schema = 'public' and c.table_name = r.tabela and c.column_name = r.coluna
                 and c.data_type = 'numeric' and c.numeric_scale is not null and c.numeric_scale < r.escala) then
      execute format('alter table public.%I alter column %I type numeric(%s,%s)', r.tabela, r.coluna, r.prec, r.escala);
    end if;
  end loop;
end $$;

-- Custo unitário de cada insumo:
--  • comprado: CMP global (ingredientes.custo_medio)
--  • preparo/sub-receita: (insumos do lote + custo fixo do lote) / rendimento
create view v_custo_ingrediente with (security_invoker = true) as
select i.id as ingrediente_id, i.nome, i.unidade_medida, i.e_produzido_internamente,
  case when i.e_produzido_internamente
       then (coalesce(r.custo_insumos, 0) + coalesce(i.custo_fixo, 1.50))
            / coalesce(nullif(i.rendimento_receita, 0), 1)
       else coalesce(i.custo_medio, 0) end as custo_unitario
from ingredientes i
left join lateral (
  select sum(pi.quantidade * coalesce(b.custo_medio, 0)) as custo_insumos
  from preparo_itens pi join ingredientes b on b.id = pi.ingrediente_id
  where pi.insumo_pai_id = i.id
) r on true;

create view v_custo_produto with (security_invoker = true) as
select p.id as produto_id, p.nome, p.preco_venda,
  c.custo_fixo,
  c.custo_ingredientes,
  c.custo_ingredientes + c.custo_fixo as custo_total,
  case when p.preco_venda > 0 then round((c.custo_ingredientes + c.custo_fixo) / p.preco_venda * 100, 1) else 0 end as cmv_percent,
  case when p.preco_venda > 0 then round((1 - (c.custo_ingredientes + c.custo_fixo) / p.preco_venda) * 100, 1) else 0 end as margem_percent
from produtos p
cross join lateral (
  select coalesce(p.custo_fixo, 1.50) as custo_fixo,   -- mesmo padrão da tela de Fichas
    coalesce((select sum(fi.quantidade * ci.custo_unitario)
              from ficha_itens fi join v_custo_ingrediente ci on ci.ingrediente_id = fi.ingrediente_id
              where fi.produto_id = p.id), 0) as custo_ingredientes
) c;

create view v_alertas_estoque with (security_invoker = true) as
select e.unidade_id, u.nome as unidade_nome, u.codigo as unidade_codigo,
  i.nome as ingrediente, e.quantidade, m.minimo as estoque_minimo, i.unidade_medida,
  case when e.quantidade <= 0 then 'sem_estoque'
       when e.quantidade < m.minimo then 'critico'
       when e.quantidade < m.minimo * 1.3 then 'baixo' else 'ok' end as status
from estoque e
join unidades u on u.id = e.unidade_id
join ingredientes i on i.id = e.ingrediente_id
-- o mínimo editado na tela de Estoque (por ingrediente) tem prioridade
cross join lateral (select coalesce(nullif(i.estoque_minimo, 0), e.estoque_minimo, 0) as minimo) m
where coalesce(i.ativo, true) and coalesce(u.ativo, true);

create view v_valor_estoque with (security_invoker = true) as
select e.unidade_id, u.nome as unidade_nome,
  round(sum(e.quantidade * coalesce(ci.custo_unitario, 0)), 2) as valor_total
from estoque e
join unidades u on u.id = e.unidade_id
left join v_custo_ingrediente ci on ci.ingrediente_id = e.ingrediente_id
group by e.unidade_id, u.nome;

-- 12. SEGURANÇA (RLS)
create or replace function public.minha_unidade() returns uuid
language sql stable security definer set search_path = public as $$
  select unidade_id from perfis where id = auth.uid(); $$;

create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' from perfis where id = auth.uid()), false); $$;

-- admin ou gerente (conta liberada)
create or replace function public.tenho_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('admin', 'gerente') from perfis where id = auth.uid()), false); $$;

-- Remove TODAS as políticas existentes nas tabelas do sistema (inclusive
-- as criadas à mão no painel) e recria só as daqui — assim nenhuma regra
-- antiga e mais permissiva fica esquecida.
do $$ declare r record; begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'unidades','perfis','fornecedores','ingredientes','estoque','compras',
      'produtos','ficha_itens','preparo_itens','configuracoes_loja','vendas')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table unidades enable row level security;
alter table perfis enable row level security;
alter table fornecedores enable row level security;
alter table ingredientes enable row level security;
alter table estoque enable row level security;
alter table compras enable row level security;
alter table produtos enable row level security;
alter table ficha_itens enable row level security;
alter table preparo_itens enable row level security;
alter table configuracoes_loja enable row level security;
alter table vendas enable row level security;

-- Unidades: todos os liberados veem; só admin cria/edita/apaga
create policy "unidades_ver" on unidades for select to authenticated using (tenho_acesso());
create policy "unidades_admin" on unidades for all to authenticated using (sou_admin()) with check (sou_admin());

-- Catálogo compartilhado: qualquer conta liberada lê e edita
do $$ declare t text; begin
  foreach t in array array['fornecedores','ingredientes','produtos','ficha_itens','preparo_itens','configuracoes_loja'] loop
    execute format('create policy "%1$s_acesso" on %1$I for all to authenticated using (tenho_acesso()) with check (tenho_acesso());', t);
  end loop;
end $$;

-- Perfis: cada um vê o seu; só admin muda papel/unidade (inclusive o próprio)
create policy "perfis_ver" on perfis for select to authenticated using (id = auth.uid() or sou_admin());
create policy "perfis_admin" on perfis for all to authenticated using (sou_admin()) with check (sou_admin());

-- Dados por unidade: admin vê tudo; gerente só a própria unidade
do $$ declare t text; begin
  foreach t in array array['estoque','compras','vendas'] loop
    execute format('create policy "%1$s_unidade" on %1$I for all to authenticated using (sou_admin() or (tenho_acesso() and unidade_id = minha_unidade())) with check (sou_admin() or (tenho_acesso() and unidade_id = minha_unidade()));', t);
  end loop;
end $$;

-- 13. UNIDADES INICIAIS (só se a tabela estiver vazia)
insert into unidades (nome, codigo, cor)
select v.nome, v.codigo, v.cor
from (values ('João Monlevade', 'U1', '#f7c915'), ('Bela Vista', 'U2', '#79e0a0')) as v(nome, codigo, cor)
where not exists (select 1 from unidades);

-- 14. PRODUÇÃO (cozinha central) E TRANSFERÊNCIAS
-- A produção é um local de estoque (uma linha de unidades marcada com
-- e_producao), mas no app ela tem tela própria e não aparece como loja.
-- Lá se registra o que foi produzido (American Cheese, molhos...) e se
-- transfere estoque para as lojas.
alter table unidades add column if not exists e_producao boolean not null default false;

-- marca a unidade "Produção" que já existir; se não houver, cria
update unidades set e_producao = true
where id = (select id from unidades
            where codigo in ('geral', 'producao') or nome ilike 'produ%'
            order by criado_em limit 1)
  and not exists (select 1 from unidades where e_producao);
insert into unidades (nome, codigo, cor, e_producao)
select 'Produção', 'producao', '#c9a227', true
where not exists (select 1 from unidades where e_producao);

create table if not exists producoes (
  id uuid primary key default uuid_generate_v4(),
  ingrediente_id uuid not null references ingredientes(id) on delete cascade, -- o preparo produzido
  unidade_id uuid not null references unidades(id),                            -- onde foi produzido
  quantidade numeric(14,3) not null check (quantidade > 0),
  baixou_insumos boolean not null default true,
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz default now()
);
create table if not exists transferencias (
  id uuid primary key default uuid_generate_v4(),
  ingrediente_id uuid not null references ingredientes(id) on delete cascade,
  origem_id uuid not null references unidades(id),
  destino_id uuid not null references unidades(id),
  quantidade numeric(14,3) not null check (quantidade > 0),
  criado_por uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz default now()
);
create index if not exists idx_producoes_data on producoes (criado_em desc);
create index if not exists idx_transferencias_data on transferencias (criado_em desc);

create or replace function public.unidade_producao() returns uuid
language sql stable set search_path = public as $$
  select id from unidades where e_producao order by criado_em limit 1; $$;

-- Soma (ou subtrai, com quantidade negativa) no estoque de um local,
-- misturando o custo médio quando entra mercadoria.
create or replace function public.somar_estoque(p_unidade uuid, p_ingrediente uuid, p_qtd numeric, p_custo numeric)
returns void language plpgsql set search_path = public as $$
begin
  update estoque set
    custo_medio = case
      when p_qtd > 0 and p_custo > 0 and quantidade > 0 and custo_medio > 0
        then (quantidade * custo_medio + p_qtd * p_custo) / (quantidade + p_qtd)
      when p_qtd > 0 and p_custo > 0 then p_custo
      else custo_medio end,
    quantidade = quantidade + p_qtd,
    atualizado_em = now()
  where unidade_id = p_unidade and ingrediente_id = p_ingrediente;
  if not found then
    insert into estoque (unidade_id, ingrediente_id, quantidade, custo_medio)
    values (p_unidade, p_ingrediente, p_qtd, greatest(coalesce(p_custo, 0), 0));
  end if;
end; $$;

-- Registra um lote produzido: soma o preparo ao estoque da produção e,
-- se pedido, desconta os insumos da receita (proporcional ao rendimento).
-- Roda com as permissões de quem chama (o RLS continua valendo).
create or replace function public.registrar_producao(p_preparo uuid, p_quantidade numeric, p_baixar_insumos boolean default true)
returns uuid language plpgsql set search_path = public as $$
declare v_prod uuid := unidade_producao(); v_rend numeric; v_custo numeric; v_id uuid; r record;
begin
  if not sou_admin() then raise exception 'Somente o administrador registra produção.'; end if;
  if v_prod is null then raise exception 'Nenhum local de produção cadastrado.'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  select coalesce(nullif(rendimento_receita, 0), 1) into v_rend
    from ingredientes where id = p_preparo and e_produzido_internamente;
  if not found then raise exception 'Esse item não é um preparo.'; end if;

  if p_baixar_insumos then
    for r in select ingrediente_id, quantidade from preparo_itens where insumo_pai_id = p_preparo loop
      perform somar_estoque(v_prod, r.ingrediente_id, -(r.quantidade * p_quantidade / v_rend), 0);
    end loop;
  end if;

  select custo_unitario into v_custo from v_custo_ingrediente where ingrediente_id = p_preparo;
  perform somar_estoque(v_prod, p_preparo, p_quantidade, coalesce(v_custo, 0));

  insert into producoes (ingrediente_id, unidade_id, quantidade, baixou_insumos)
  values (p_preparo, v_prod, p_quantidade, p_baixar_insumos) returning id into v_id;
  return v_id;
end; $$;

-- Transfere estoque de um local para outro (por padrão, da produção para
-- uma loja) numa única operação: ou sai de um e entra no outro, ou nada muda.
create or replace function public.transferir_estoque(p_ingrediente uuid, p_destino uuid, p_quantidade numeric, p_origem uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare v_origem uuid := coalesce(p_origem, unidade_producao()); v_disp numeric; v_custo numeric; v_id uuid;
begin
  if not sou_admin() then raise exception 'Somente o administrador faz transferências.'; end if;
  if v_origem is null then raise exception 'Nenhum local de produção cadastrado.'; end if;
  if p_destino is null or p_destino = v_origem then raise exception 'Escolha um destino diferente da origem.'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;

  select quantidade, custo_medio into v_disp, v_custo
    from estoque where unidade_id = v_origem and ingrediente_id = p_ingrediente for update;
  if coalesce(v_disp, 0) < p_quantidade then
    raise exception 'Estoque insuficiente: há % na origem.',
      replace(rtrim(to_char(coalesce(v_disp, 0), 'FM999999990.999'), '.'), '.', ',');
  end if;

  update estoque set quantidade = quantidade - p_quantidade, atualizado_em = now()
   where unidade_id = v_origem and ingrediente_id = p_ingrediente;
  perform somar_estoque(p_destino, p_ingrediente, p_quantidade, coalesce(v_custo, 0));

  insert into transferencias (ingrediente_id, origem_id, destino_id, quantidade)
  values (p_ingrediente, v_origem, p_destino, p_quantidade) returning id into v_id;
  return v_id;
end; $$;

alter table producoes enable row level security;
alter table transferencias enable row level security;
drop policy if exists "producoes_ver" on producoes;
drop policy if exists "producoes_admin" on producoes;
drop policy if exists "transferencias_ver" on transferencias;
drop policy if exists "transferencias_admin" on transferencias;
-- histórico: qualquer conta liberada vê a produção; transferências, quem é da origem ou do destino
create policy "producoes_ver" on producoes for select to authenticated using (tenho_acesso());
create policy "producoes_admin" on producoes for all to authenticated using (sou_admin()) with check (sou_admin());
create policy "transferencias_ver" on transferencias for select to authenticated
  using (sou_admin() or (tenho_acesso() and (origem_id = minha_unidade() or destino_id = minha_unidade())));
create policy "transferencias_admin" on transferencias for all to authenticated using (sou_admin()) with check (sou_admin());

-- 15. MEDIDAS
-- Cada insumo guarda tudo numa medida base (kg, g, l, ml ou un); a tela deixa
-- digitar em g ou kg, ml ou L e converte. Aqui: padroniza os nomes das
-- medidas (UN, Kg, KILO… → un, kg) e permite trocar a medida de um insumo.
update ingredientes set unidade_medida = case lower(trim(coalesce(unidade_medida, 'un')))
  when 'kgs' then 'kg' when 'quilo' then 'kg' when 'quilos' then 'kg' when 'kilo' then 'kg' when 'kilos' then 'kg'
  when 'gr' then 'g' when 'grs' then 'g' when 'grama' then 'g' when 'gramas' then 'g'
  when 'lt' then 'l' when 'lts' then 'l' when 'litro' then 'l' when 'litros' then 'l'
  when 'mls' then 'ml'
  when 'und' then 'un' when 'unid' then 'un' when 'unidade' then 'un' when 'unidades' then 'un' when 'u' then 'un'
  else lower(trim(coalesce(unidade_medida, 'un'))) end;

-- Troca a medida de um insumo. Na mesma família (kg ↔ g, L ↔ ml) converte
-- estoque, compras, fichas, preparos e histórico; entre famílias diferentes
-- (un → kg, para corrigir um cadastro errado) só troca o rótulo.
create or replace function public.trocar_medida_insumo(p_ingrediente uuid, p_nova text)
returns void language plpgsql set search_path = public as $$
declare v_antiga text; v_nova text := lower(trim(p_nova)); f numeric := 1; fa numeric; fn numeric; ga text; gn text;
begin
  if not sou_admin() then raise exception 'Somente o administrador troca a medida de um insumo.'; end if;
  select lower(trim(unidade_medida)) into v_antiga from ingredientes where id = p_ingrediente for update;
  if not found then raise exception 'Insumo não encontrado.'; end if;

  select v.fam, v.fator into ga, fa
    from (values ('kg', 'massa', 1000), ('g', 'massa', 1), ('l', 'volume', 1000), ('ml', 'volume', 1), ('un', 'contagem', 1)) as v(m, fam, fator)
   where v.m = v_antiga;
  select v.fam, v.fator into gn, fn
    from (values ('kg', 'massa', 1000), ('g', 'massa', 1), ('l', 'volume', 1000), ('ml', 'volume', 1), ('un', 'contagem', 1)) as v(m, fam, fator)
   where v.m = v_nova;
  if gn is null then raise exception 'Medida inválida: use kg, g, L, ml ou un.'; end if;

  if ga = gn and fa <> fn then f := fa / fn; end if;
  if f <> 1 then
    update estoque set quantidade = quantidade * f, estoque_minimo = estoque_minimo * f, custo_medio = custo_medio / f
     where ingrediente_id = p_ingrediente;
    update compras set quantidade = quantidade * f, preco_unitario = preco_unitario / f
     where ingrediente_id = p_ingrediente and quantidade > 0;
    update ficha_itens set quantidade = quantidade * f where ingrediente_id = p_ingrediente;
    update preparo_itens set quantidade = quantidade * f where ingrediente_id = p_ingrediente;
    update producoes set quantidade = quantidade * f where ingrediente_id = p_ingrediente;
    update transferencias set quantidade = quantidade * f where ingrediente_id = p_ingrediente;
  end if;

  update ingredientes set
    unidade_medida = v_nova,
    custo_medio = custo_medio / f,
    estoque_minimo = estoque_minimo * f,
    rendimento_receita = case when e_produzido_internamente then rendimento_receita * f else rendimento_receita end
  where id = p_ingrediente;
end; $$;
