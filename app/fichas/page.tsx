'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { brl, num } from '@/lib/format';

type Produto = {
  id: string;
  nome: string;
  preco_venda: number;
  custo_fixo?: number;
  custo_extra?: number;
  custo_salao?: number;
  categoria?: string | null;
  ativo: boolean;
};

type Ingrediente = {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_medio: number;
};

type FichaItem = {
  id: string;
  produto_id: string;
  ingrediente_id: string;
  quantidade: number;
  ingredientes?: Ingrediente;
};

const CATEGORIAS = [
  'Burguer Simples',
  'Burguer Duplo',
  'Burguer Triplo',
  'Burguer Alto',
  'Burguer do mês',
  'Veggies',
  'Molho Adicional',
  'Acompanhamentos',
  'Milkshakes'
];

export default function FichasPage() {
  const supabase = createClient();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [fichas, setFichas] = useState<FichaItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estado do Filtro
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');

  // Estados do Modal
  const [produtoModal, setProdutoModal] = useState<Produto | null>(null);
  const [ingredienteBusca, setIngredienteBusca] = useState(''); // Estado alterado para busca por texto
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [salvandoItem, setSalvandoItem] = useState(false);

  // Estados de Edição Inline (na tabela do modal)
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');

  async function carregarDados() {
    setCarregando(true);
    const [resProd, resIng, resFichas, resCusto] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('ficha_itens').select('*'),
      supabase.from('v_custo_ingrediente').select('ingrediente_id, custo_unitario'),
    ]);

    // Custo efetivo de cada insumo (preparos/molhos usam o custo da receita,
    // não o CMP de compra, que para eles é zero). Mesma conta do CMV.
    const custoDe = new Map((resCusto.data || []).map((c) => [c.ingrediente_id, Number(c.custo_unitario)]));
    const ings: Ingrediente[] = (resIng.data || []).map((i) => ({ ...i, custo_medio: custoDe.get(i.id) ?? i.custo_medio }));

    if (resProd.data) setProdutos(resProd.data);
    if (resIng.data) setIngredientes(ings);
    if (resFichas.data && resIng.data) {
      setFichas(resFichas.data.map((item) => ({
        ...item, ingredientes: ings.find((ing) => ing.id === item.ingrediente_id),
      })));
    }
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  async function handleAdicionarIngrediente(e: React.FormEvent) {
    e.preventDefault();
    if (!produtoModal || !ingredienteBusca || !quantidadeInput) return;

    // Busca o ID do insumo com base no nome digitado
    const ingEncontrado = ingredientes.find(i => i.nome.toLowerCase() === ingredienteBusca.toLowerCase());
    
    if (!ingEncontrado) {
      alert('Por favor, selecione um insumo válido da lista.');
      return;
    }

    setSalvandoItem(true);
    const { error } = await supabase.from('ficha_itens').insert({
      produto_id: produtoModal.id, 
      ingrediente_id: ingEncontrado.id, 
      quantidade: Number(quantidadeInput.replace(',', '.'))
    });

    if (!error) { 
      setIngredienteBusca(''); 
      setQuantidadeInput(''); 
      await carregarDados(); 
    } else { 
      alert('Erro: ' + error.message); 
    }
    
    setSalvandoItem(false);
  }

  async function handleRemoverIngrediente(idItem: string) {
    if (!confirm('Remover ingrediente da ficha?')) return;
    const { error } = await supabase.from('ficha_itens').delete().eq('id', idItem);
    if (error) alert('Erro ao remover: ' + error.message);
    carregarDados();
  }

  async function handleSalvarEdicao(idItem: string) {
    const qtdNum = Number(editQtd.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      alert('Quantidade inválida.');
      return;
    }
    
    const { error } = await supabase.from('ficha_itens').update({ quantidade: qtdNum }).eq('id', idItem);
    
    if (error) {
      alert('Erro ao editar: ' + error.message);
    } else {
      setEditandoItemId(null);
      await carregarDados();
    }
  }

  function iniciarEdicao(item: FichaItem) {
    setEditandoItemId(item.id);
    setEditQtd(String(item.quantidade).replace('.', ','));
  }

  // Filtra os produtos com base na categoria selecionada
  const produtosFiltrados = produtos.filter(prod => {
    if (filtroCategoria === 'Todos') return true;
    if (filtroCategoria === 'Sem Categoria') return !prod.categoria || prod.categoria.trim() === '';
    return prod.categoria === filtroCategoria;
  });

  return (
    <>
      <TopBar titulo="Fichas Técnicas dos Produtos" />
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }
        
        .scroll-chips { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 16px; }
        .scroll-chips::-webkit-scrollbar { height: 4px; }
        .scroll-chips::-webkit-scrollbar-track { background: transparent; }
        .scroll-chips::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }
        
        .chip { padding: 8px 16px; white-space: nowrap; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .chip.act { background: var(--gold); color: #000; font-weight: bold; border: none; }
        .chip.inac { background: var(--surf); color: var(--txt); border: 1px solid var(--line); }

        .tabela-fichas { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 700px; }
        .tabela-fichas th { padding: 16px 12px; font-weight: 500; color: var(--dim); border-bottom: 1px solid var(--line); }
        .tabela-fichas td { padding: 16px 12px; border-bottom: 1px solid var(--line); }
        .btn-ficha { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; display: inline-block; white-space: nowrap; }
        
        .modal-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
        .modal-table th { padding: 12px; color: var(--dim); border-bottom: 1px solid var(--line); font-weight: normal; }
        .modal-table td { padding: 12px; border-bottom: 1px solid var(--line); color: var(--txt); vertical-align: middle; }
        .modal-input { background: var(--bg); border: 1px solid var(--gold); color: var(--txt); border-radius: 4px; outline: none; padding: 6px; width: 100%; box-sizing: border-box; text-align: center; }
        .btn-sm { padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; border: none; font-size: 12px; }
        .btn-sm.gold { background: var(--gold); color: #000; }
        .btn-sm.surf { background: var(--surf); color: var(--txt); border: 1px solid var(--line); }
        .btn-sm.red { background: var(--rdim); color: var(--red); }
        
        .qtd-wrap { display: flex; gap: 4px; align-items: center; }
        .action-cell { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }

        @media (max-width: 768px) {
          .tabela-fichas { font-size: 12px; }
          .tabela-fichas th, .tabela-fichas td { padding: 12px 6px; font-size: 11px; }
          .hide-mobile { display: none; }
          
          .modal-table { font-size: 11px; }
          .modal-table th, .modal-table td { padding: 8px 4px; }
          .modal-input { padding: 6px 2px; font-size: 11px; }
          .btn-sm { padding: 6px 4px; font-size: 10px; flex: 1; text-align: center; }
          .qtd-wrap { flex-direction: column; align-items: stretch; gap: 2px; }
          .action-cell { flex-direction: column; align-items: stretch; gap: 4px; }
        }
      `}} />

      <div className="wrap">
        <div className="lbl" style={{ marginBottom: '16px' }}>Engenharia de Cardápio e Custos</div>

        <div className="scroll-chips">
          {['Todos', ...CATEGORIAS, 'Sem Categoria'].map((cat) => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} className={`chip ${filtroCategoria === cat ? 'act' : 'inac'}`}>
              {cat}
            </button>
          ))}
        </div>

        {carregando ? ( <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>Carregando...</div> ) : (
          <div className="panel custom-scroll" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="tabela-fichas">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ paddingLeft: '20px' }}>Produto</th>
                  <th>Preço Venda</th>
                  <th>Custo Insumos</th>
                  <th>Custo Fixo</th>
                  <th>Custo Total</th>
                  <th>Margem / CMV</th>
                  <th style={{ paddingRight: '20px', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((prod) => {
                  const itensDoProduto = fichas.filter((f) => f.produto_id === prod.id);
                  const custoInsumos = itensDoProduto.reduce((acc, item) => acc + (item.quantidade * Number(item.ingredientes?.custo_medio || 0)), 0);
                  
                  const custoFixo = Number(prod.custo_fixo ?? prod.custo_extra ?? prod.custo_salao ?? 1.50);
                  const custoTotal = custoInsumos + custoFixo;
                  
                  const pVenda = Number(prod.preco_venda || 0);
                  const lucro = pVenda - custoTotal;
                  const cmvPercent = pVenda > 0 ? (custoTotal / pVenda) * 100 : 0;
                  const margemPercent = pVenda > 0 ? (lucro / pVenda) * 100 : 0;

                  return (
                    <tr key={prod.id} onClick={() => setProdutoModal(prod)} style={{ cursor: 'pointer', borderLeft: itensDoProduto.length > 0 ? '4px solid var(--grn)' : '4px solid var(--gold)' }}>
                      <td style={{ paddingLeft: '20px', color: 'var(--txt)' }}>
                        <b style={{ fontSize: 15, display: 'block' }}>{prod.nome}</b>
                        {prod.categoria && <span style={{ fontSize: 11, color: 'var(--dim)' }}>{prod.categoria}</span>}
                      </td>
                      <td style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{brl(pVenda)}</td>
                      <td style={{ color: 'var(--txt)' }}>{brl(custoInsumos)}</td>
                      <td style={{ color: 'var(--dim)' }}>{brl(custoFixo)}</td>
                      <td style={{ color: 'var(--txt)', fontWeight: 'bold' }}>{brl(custoTotal)}</td>
                      <td>
                        {pVenda > 0 ? (
                          <div>
                            <span style={{ color: margemPercent >= 50 ? 'var(--grn)' : 'var(--gold)', fontWeight: 'bold', fontSize: 13 }}>{num(margemPercent, 1)}% margem</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--dim)' }}>CMV: {num(cmvPercent, 1)}%</span>
                          </div>
                        ) : ( <span style={{ fontSize: 12, color: 'var(--dim)' }}>—</span> )}
                      </td>
                      <td style={{ paddingRight: '20px', textAlign: 'right' }}>
                        {itensDoProduto.length > 0 ? <span className="btn-ficha" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--grn)' }}>Ver</span> : <span className="btn-ficha" style={{ background: 'var(--rdim)', color: 'var(--red)' }}>⚠️ Montar</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALHES FICHA */}
      {produtoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="panel custom-scroll" style={{ width: '100%', maxWidth: '650px', padding: '24px', borderRadius: '12px', background: 'var(--bg)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--txt)', fontSize: '20px' }}>Ficha Técnica</h3>
                <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{produtoModal.nome}</div>
              </div>
              <button onClick={() => { setProdutoModal(null); setEditandoItemId(null); }} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '24px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--surf)', padding: '16px', borderRadius: '8px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div><span style={{ fontSize: '11px', color: 'var(--dim)', display: 'block' }}>Preço Venda</span><b style={{ fontSize: '16px', color: 'var(--gold)' }}>{brl(produtoModal.preco_venda)}</b></div>
              <div><span style={{ fontSize: '11px', color: 'var(--dim)', display: 'block' }}>Custo Fixo</span><b style={{ fontSize: '16px', color: 'var(--txt)' }}>{brl(produtoModal.custo_fixo ?? produtoModal.custo_extra ?? produtoModal.custo_salao ?? 1.50)}</b></div>
              <div><span style={{ fontSize: '11px', color: 'var(--dim)', display: 'block' }}>Categoria</span><b style={{ fontSize: '14px', color: 'var(--txt)' }}>{produtoModal.categoria || 'Geral'}</b></div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--dim)', marginBottom: '12px', fontWeight: 'bold' }}>Composição do Produto</div>
              <div style={{ background: 'var(--surf)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Qtd Uso</th>
                      <th className="hide-mobile">Custo UND</th>
                      <th>Total</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fichas.filter((f) => f.produto_id === produtoModal.id).length === 0 ? (
                       <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--gold)' }}>Nenhum insumo vinculado a este produto.</td></tr>
                    ) : (
                      fichas.filter((f) => f.produto_id === produtoModal.id).map((item) => {
                        const cUnd = Number(item.ingredientes?.custo_medio || 0);
                        const isEditing = editandoItemId === item.id;

                        return (
                          <tr key={item.id} style={{ background: isEditing ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                            <td>{item.ingredientes?.nome}</td>
                            
                            <td>
                              {isEditing ? (
                                <div className="qtd-wrap">
                                  <input type="text" className="modal-input" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} autoFocus />
                                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>{item.ingredientes?.unidade_medida}</span>
                                </div>
                              ) : (
                                <span>{num(item.quantidade, 3)} <span style={{ fontSize: '10px', color: 'var(--dim)' }}>{item.ingredientes?.unidade_medida}</span></span>
                              )}
                            </td>

                            <td className="hide-mobile">{brl(cUnd)}</td>
                            <td style={{ fontWeight: 'bold' }}>{brl(item.quantidade * cUnd)}</td>
                            
                            <td>
                              <div className="action-cell">
                                {isEditing ? (
                                  <>
                                    <button onClick={() => handleSalvarEdicao(item.id)} className="btn-sm gold">Salvar</button>
                                    <button onClick={() => setEditandoItemId(null)} className="btn-sm surf">✕</button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => iniciarEdicao(item)} className="btn-sm surf">Editar</button>
                                    <button onClick={() => handleRemoverIngrediente(item.id)} className="btn-sm red">Apagar</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <form onSubmit={handleAdicionarIngrediente} style={{ borderTop: '1px solid var(--line)', paddingTop: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Insumo</label>
                {/* CAMPO DE BUSCA E SELEÇÃO INTELIGENTE (DATALIST) */}
                <input 
                  list="lista-fichas-ingredientes" 
                  value={ingredienteBusca} 
                  onChange={(e) => setIngredienteBusca(e.target.value)} 
                  placeholder="Digite ou selecione..."
                  style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} 
                  required 
                />
                <datalist id="lista-fichas-ingredientes">
                  {ingredientes.map((ing) => (
                    <option key={ing.id} value={ing.nome} />
                  ))}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Qtd</label>
                <input type="text" value={quantidadeInput} onChange={(e) => setQuantidadeInput(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px' }} required />
              </div>
              <button type="submit" disabled={salvandoItem} style={{ padding: '12px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}