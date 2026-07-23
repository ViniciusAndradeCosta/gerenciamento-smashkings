-- ============================================================
-- SmashKings — Dados de exemplo (rode DEPOIS do schema.sql)
-- ============================================================

-- Unidades
insert into unidades (nome, codigo, cor) values
  ('Unidade Centro', 'U1', '#4fc3f7'),
  ('Unidade Norte',  'U2', '#2dd36f')
on conflict (codigo) do nothing;

-- Fornecedores
insert into fornecedores (nome, telefone) values
  ('Atacadão', '(00) 0000-0000'),
  ('Bob Distribuidor', '(00) 0000-0000'),
  ('Frigorífico Central', '(00) 0000-0000');

-- Ingredientes
insert into ingredientes (nome, unidade_medida, categoria) values
  ('Blend Smash 150g', 'un', 'Carnes'),
  ('Pão Brioche', 'un', 'Padaria'),
  ('Queijo Cheddar', 'kg', 'Laticínios'),
  ('Bacon Fatiado', 'kg', 'Carnes'),
  ('Batata Palito', 'kg', 'Congelados'),
  ('Maionese Artesanal', 'kg', 'Molhos');

-- Estoque inicial por unidade (quantidade, custo_medio = CMP, mínimo)
-- Centro (U1)
insert into estoque (unidade_id, ingrediente_id, quantidade, custo_medio, estoque_minimo)
select u.id, i.id, v.q, v.c, v.m from unidades u
join (values
  ('Blend Smash 150g',28,5.42,12),
  ('Pão Brioche',8,1.20,20),
  ('Queijo Cheddar',0.42,38.50,0.30),
  ('Bacon Fatiado',0.5,42.00,1.20),
  ('Batata Palito',7,8.50,3),
  ('Maionese Artesanal',1.5,22.00,0.60)
) as v(nome,q,c,m) on true
join ingredientes i on i.nome = v.nome
where u.codigo='U1';

-- Norte (U2)
insert into estoque (unidade_id, ingrediente_id, quantidade, custo_medio, estoque_minimo)
select u.id, i.id, v.q, v.c, v.m from unidades u
join (values
  ('Blend Smash 150g',20,5.42,10),
  ('Pão Brioche',4,1.20,15),
  ('Queijo Cheddar',0.20,38.50,0.20),
  ('Bacon Fatiado',0.3,42.00,0.80),
  ('Batata Palito',5,8.50,2),
  ('Maionese Artesanal',0.9,22.00,0.40)
) as v(nome,q,c,m) on true
join ingredientes i on i.nome = v.nome
where u.codigo='U2';

-- Produtos (fichas técnicas)
insert into produtos (nome, preco_venda, custo_extra) values
  ('Smash Clássico', 24.00, 1.40),
  ('Double Smash Bacon', 32.00, 2.00),
  ('Crispy Chicken', 26.00, 1.60),
  ('Combo Smash + Fritas', 42.00, 2.80);

-- Ficha do Smash Clássico
insert into ficha_itens (produto_id, ingrediente_id, quantidade)
select p.id, i.id, v.q from produtos p
join (values ('Blend Smash 150g',1),('Pão Brioche',1),('Queijo Cheddar',0.04),('Maionese Artesanal',0.02)) as v(nome,q) on true
join ingredientes i on i.nome=v.nome
where p.nome='Smash Clássico';

-- Ficha do Double Smash Bacon
insert into ficha_itens (produto_id, ingrediente_id, quantidade)
select p.id, i.id, v.q from produtos p
join (values ('Blend Smash 150g',2),('Pão Brioche',1),('Queijo Cheddar',0.06),('Bacon Fatiado',0.05),('Maionese Artesanal',0.02)) as v(nome,q) on true
join ingredientes i on i.nome=v.nome
where p.nome='Double Smash Bacon';

-- Algumas compras de exemplo (o trigger recalcula o CMP automaticamente)
insert into compras (unidade_id, ingrediente_id, fornecedor_id, quantidade, preco_unitario)
select u.id, i.id, f.id, 30, 5.45 from unidades u, ingredientes i, fornecedores f
where u.codigo='U1' and i.nome='Blend Smash 150g' and f.nome='Frigorífico Central';

-- Vendas de exemplo
insert into vendas (unidade_id, produto_id, quantidade, valor_total)
select u.id, p.id, 3, 72.00 from unidades u, produtos p
where u.codigo='U1' and p.nome='Smash Clássico';
