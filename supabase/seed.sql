-- ============================================================
-- SmashKings — Dados de EXEMPLO (rode DEPOIS do schema.sql)
--
-- ⚠️  Só para testar/demonstrar. NÃO rode no banco que a hamburgueria vai
--     usar de verdade: ele cria fornecedores, insumos, produtos, compras e
--     vendas fictícios. As unidades já são criadas pelo schema.sql.
-- ============================================================

-- Unidades (cores alinhadas ao visual do app: dourado da marca + verde)
insert into unidades (nome, codigo, cor) values
  ('João Monlevade', 'U1', '#f7c915'),
  ('Bela Vista',     'U2', '#79e0a0')
on conflict (codigo) do update
  set nome = excluded.nome, cor = excluded.cor;

-- Fornecedores
insert into fornecedores (nome, telefone) values
  ('Atacadão', '(00) 0000-0000'),
  ('Bob Distribuidor', '(00) 0000-0000'),
  ('Frigorífico Central', '(00) 0000-0000');

-- Ingredientes (custo_medio = CMP global; estoque_minimo = alerta)
insert into ingredientes (nome, unidade_medida, categoria, custo_medio, estoque_minimo) values
  ('Blend Smash 150g', 'un', 'Carnes', 5.42, 12),
  ('Pão Brioche', 'un', 'Padaria', 1.20, 20),
  ('Queijo Cheddar', 'kg', 'Laticínios', 38.50, 0.30),
  ('Bacon Fatiado', 'kg', 'Carnes', 42.00, 1.20),
  ('Batata Palito', 'kg', 'Congelados', 8.50, 3),
  ('Maionese Artesanal', 'kg', 'Molhos', 22.00, 0.60);

-- Estoque inicial por unidade (quantidade, custo_medio = CMP, mínimo)
-- João Monlevade (U1)
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

-- Bela Vista (U2)
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
insert into produtos (nome, preco_venda, custo_fixo, categoria) values
  ('Smash Clássico', 24.00, 1.50, 'Burguer Simples'),
  ('Double Smash Bacon', 32.00, 1.50, 'Burguer Duplo'),
  ('Crispy Chicken', 26.00, 1.50, 'Burguer Simples'),
  ('Combo Smash + Fritas', 42.00, 1.50, 'Acompanhamentos');

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
