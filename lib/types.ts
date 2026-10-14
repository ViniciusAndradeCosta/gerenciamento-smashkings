export type Unidade = { id: string; nome: string; codigo: string; cor: string };
export type Estoque = {
  id: string; unidade_id: string; ingrediente_id: string;
  quantidade: number; custo_medio: number; estoque_minimo: number;
  ingredientes?: { nome: string; unidade_medida: string };
  unidades?: { nome: string; codigo: string };
};
export type Alerta = {
  unidade_id: string; unidade_nome: string; unidade_codigo: string;
  ingrediente: string; quantidade: number; estoque_minimo: number;
  unidade_medida: string; status: 'ok' | 'baixo' | 'critico' | 'sem_estoque';
};
export type CustoProduto = {
  produto_id: string; nome: string; preco_venda: number; custo_fixo: number;
  custo_ingredientes: number; custo_total: number; cmv_percent: number; margem_percent: number;
};
