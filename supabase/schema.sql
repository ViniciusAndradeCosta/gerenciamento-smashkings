-- ============================================================
-- SmashKings — Schema do banco (Supabase / PostgreSQL)
-- Multi-unidade · CMP (Custo Médio Ponderado) e CMV automáticos
-- Rode inteiro no Supabase: SQL Editor > New query > Run
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

-- 2. PERFIS (liga auth.users a unidade e papel)
create table if not exists perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  papel      text not null default 'gerente',   -- 'admin' | 'gerente'
  unidade_id uuid references unidades(id),       -- null = admin, vê todas
  criado_em  timestamptz default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into perfis (id, nome, papel)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'admin');
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- 3. FORNECEDORES
create table if not exists fornecedores (
  id uuid primary key default uuid_generate_v4(),
  nome text not null, telefone text, criado_em timestamptz default now()
);

-- 4. INGREDIENTES (compartilhado)
create table if not exists ingredientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  unidade_medida text not null default 'un',
  categoria text, ativo boolean default true, criado_em timestamptz default now()
);

-- 5. ESTOQUE POR UNIDADE (quantidade + CMP)
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

-- CMP = (q_atual*c_atual + q_compra*preco) / (q_atual + q_compra)
create or replace function aplicar_compra()
returns trigger language plpgsql as $$
declare q_atual numeric(14,3); c_atual numeric(14,4); novo_cmp numeric(14,4);
begin
  select quantidade, custo_medio into q_atual, c_atual
  from estoque where unidade_id=new.unidade_id and ingrediente_id=new.ingrediente_id;
  if not found then
    insert into estoque (unidade_id, ingrediente_id, quantidade, custo_medio)
    values (new.unidade_id, new.ingrediente_id, new.quantidade, new.preco_unitario);
  else
    if (q_atual + new.quantidade) = 0 then novo_cmp := new.preco_unitario;
    else novo_cmp := (q_atual*c_atual + new.quantidade*new.preco_unitario)/(q_atual+new.quantidade);
    end if;
    update estoque set quantidade=q_atual+new.quantidade, custo_medio=novo_cmp, atualizado_em=now()
    where unidade_id=new.unidade_id and ingrediente_id=new.ingrediente_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_aplicar_compra on compras;
create trigger trg_aplicar_compra after insert on compras
  for each row execute function aplicar_compra();

-- 7. FICHAS TÉCNICAS
create table if not exists produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  preco_venda numeric(14,2) not null default 0,
  custo_extra numeric(14,2) not null default 0,
  ativo boolean default true, criado_em timestamptz default now()
);
create table if not exists ficha_itens (
  id uuid primary key default uuid_generate_v4(),
  produto_id uuid not null references produtos(id) on delete cascade,
  ingrediente_id uuid not null references ingredientes(id),
  quantidade numeric(14,3) not null
);

-- 8. VENDAS
create table if not exists vendas (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references unidades(id),
  produto_id uuid references produtos(id),
  quantidade integer not null default 1,
  valor_total numeric(14,2) not null,
  data_venda date not null default current_date,
  criado_em timestamptz default now()
);

-- 9. VIEWS
create or replace view v_custo_produto as
select p.id as produto_id, p.nome, p.preco_venda, p.custo_extra,
  coalesce(sum(fi.quantidade*e.custo_medio),0) as custo_ingredientes,
  coalesce(sum(fi.quantidade*e.custo_medio),0)+p.custo_extra as custo_total,
  case when p.preco_venda>0 then round(((coalesce(sum(fi.quantidade*e.custo_medio),0)+p.custo_extra)/p.preco_venda)*100,1) else 0 end as cmv_percent,
  case when p.preco_venda>0 then round((1-(coalesce(sum(fi.quantidade*e.custo_medio),0)+p.custo_extra)/p.preco_venda)*100,1) else 0 end as margem_percent
from produtos p
left join ficha_itens fi on fi.produto_id=p.id
left join lateral (select custo_medio from estoque e2 where e2.ingrediente_id=fi.ingrediente_id order by e2.atualizado_em desc limit 1) e on true
group by p.id;

create or replace view v_alertas_estoque as
select e.unidade_id, u.nome as unidade_nome, u.codigo as unidade_codigo,
  i.nome as ingrediente, e.quantidade, e.estoque_minimo, i.unidade_medida,
  case when e.quantidade<=0 then 'sem_estoque'
       when e.quantidade<e.estoque_minimo then 'critico'
       when e.quantidade<e.estoque_minimo*1.3 then 'baixo' else 'ok' end as status
from estoque e join unidades u on u.id=e.unidade_id join ingredientes i on i.id=e.ingrediente_id;

create or replace view v_valor_estoque as
select e.unidade_id, u.nome as unidade_nome, round(sum(e.quantidade*e.custo_medio),2) as valor_total
from estoque e join unidades u on u.id=e.unidade_id group by e.unidade_id, u.nome;

-- 10. RLS
alter table unidades enable row level security;
alter table perfis enable row level security;
alter table fornecedores enable row level security;
alter table ingredientes enable row level security;
alter table estoque enable row level security;
alter table compras enable row level security;
alter table produtos enable row level security;
alter table ficha_itens enable row level security;
alter table vendas enable row level security;

create or replace function minha_unidade() returns uuid language sql stable security definer as $$
  select unidade_id from perfis where id = auth.uid(); $$;
create or replace function sou_admin() returns boolean language sql stable security definer as $$
  select coalesce((select unidade_id is null from perfis where id = auth.uid()), false); $$;

do $$ declare t text; begin
  foreach t in array array['unidades','fornecedores','ingredientes','produtos','ficha_itens'] loop
    execute format('drop policy if exists "%s_select" on %I;', t, t);
    execute format('create policy "%s_select" on %I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists "%s_write" on %I;', t, t);
    execute format('create policy "%s_write" on %I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;

drop policy if exists "perfis_self" on perfis;
create policy "perfis_self" on perfis for all to authenticated
  using (id = auth.uid() or sou_admin()) with check (id = auth.uid() or sou_admin());

do $$ declare t text; begin
  foreach t in array array['estoque','compras','vendas'] loop
    execute format('drop policy if exists "%s_unidade" on %I;', t, t);
    execute format('create policy "%1$s_unidade" on %1$I for all to authenticated using (sou_admin() or unidade_id = minha_unidade()) with check (sou_admin() or unidade_id = minha_unidade());', t);
  end loop;
end $$;
