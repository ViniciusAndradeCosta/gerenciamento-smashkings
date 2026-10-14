'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { brl, num } from '@/lib/format';

type Ingrediente = {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_medio?: number;
  custo_fixo?: number;
  custo_salao?: number;
  e_produzido_internamente?: boolean;
  rendimento_receita?: number;
};

type ItemPreparo = {
  id: string;
  insumo_pai_id: string;
  ingrediente_id: string;
  quantidade: number;
  ingredientes?: Ingrediente;
};

export default function PreparosPage() {
  const supabase = createClient();

  const [preparos, setPreparos] = useState<Ingrediente[]>([]);
  const [ingredientesBrutos, setIngredientesBrutos] = useState<Ingrediente[]>([]);
  const [itensPreparo, setItensPreparo] = useState<ItemPreparo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados do Modal
  const [preparoModal, setPreparoModal] = useState<Ingrediente | null>(null);
  const [ingredienteBusca, setIngredienteBusca] = useState(''); // Estado alterado para busca por texto
  const [quantidadeInput, setQuantidadeInput] = useState('');
  const [rendimentoInput, setRendimentoInput] = useState('');
  const [salvandoItem, setSalvandoItem] = useState(false);

  // Estados de Edição Inline
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');

  // Cadastro de novo preparo
  const [novoNome, setNovoNome] = useState('');
  const [novaMedida, setNovaMedida] = useState('kg');
  const [novoRendimento, setNovoRendimento] = useState('');
  const [criando, setCriando] = useState(false);

  async function handleCriarPreparo(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    const rendimento = Number(novoRendimento.replace(',', '.'));
    if (!nome || isNaN(rendimento) || rendimento <= 0) {
      alert('Informe o nome e um rendimento maior que zero.');
      return;
    }
    if ([...preparos, ...ingredientesBrutos].some((i) => i.nome.toLowerCase().trim() === nome.toLowerCase())) {
      alert('Já existe um insumo com esse nome.');
      return;
    }

    setCriando(true);
    const { data: config } = await supabase.from('configuracoes_loja').select('custo_fixo_padrao').limit(1).maybeSingle();
    const { error } = await supabase.from('ingredientes').insert({
      nome,
      unidade_medida: novaMedida,
      e_produzido_internamente: true,
      rendimento_receita: rendimento,
      custo_fixo: config?.custo_fixo_padrao ?? 1.5,
      ativo: true,
    });
    setCriando(false);

    if (error) {
      alert('Erro ao criar preparo: ' + error.message);
    } else {
      setNovoNome('');
      setNovoRendimento('');
      await carregarDados();
    }
  }

  async function carregarDados() {
    setCarregando(true);
    const [resIng, resPreparoItens] = await Promise.all([
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('preparo_itens').select('*'),
    ]);

    if (resIng.data) {
      const todosIngredientes = resIng.data;
      setPreparos(todosIngredientes.filter((i) => i.e_produzido_internamente));
      setIngredientesBrutos(todosIngredientes.filter((i) => !i.e_produzido_internamente));

      if (resPreparoItens.data) {
        const itensCompletos = resPreparoItens.data.map((item) => ({
          ...item,
          ingredientes: todosIngredientes.find((ing) => ing.id === item.ingrediente_id),
        }));
        setItensPreparo(itensCompletos);
      }
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function handleAdicionarIngrediente(e: React.FormEvent) {
    e.preventDefault();
    if (!preparoModal || !ingredienteBusca || !quantidadeInput) return;

    // Busca o ID do ingrediente com base no nome digitado
    const ingEncontrado = ingredientesBrutos.find(i => i.nome.toLowerCase() === ingredienteBusca.toLowerCase());
    
    if (!ingEncontrado) {
      alert('Por favor, selecione um ingrediente válido da lista.');
      return;
    }

    setSalvandoItem(true);
    const qtdNum = Number(quantidadeInput.replace(',', '.'));

    const { error } = await supabase.from('preparo_itens').insert({
      insumo_pai_id: preparoModal.id,
      ingrediente_id: ingEncontrado.id,
      quantidade: qtdNum,
    });

    if (error) {
      alert('Erro ao adicionar ingrediente: ' + error.message);
    } else {
      setIngredienteBusca('');
      setQuantidadeInput('');
      await carregarDados();
    }
    setSalvandoItem(false);
  }

  async function handleRemoverIngrediente(idItem: string) {
    if (!confirm('Remover este insumo da receita de preparo?')) return;
    const { error } = await supabase.from('preparo_itens').delete().eq('id', idItem);
    if (error) {
      alert('Erro ao remover: ' + error.message);
    } else {
      carregarDados();
    }
  }

  async function handleAtualizarRendimento() {
    if (!preparoModal || !rendimentoInput) return;
    const rendNum = Number(rendimentoInput.replace(',', '.'));

    const { error } = await supabase
      .from('ingredientes')
      .update({ rendimento_receita: rendNum })
      .eq('id', preparoModal.id);

    if (error) {
      alert('Erro ao atualizar: ' + error.message);
    } else {
      alert('Rendimento do lote atualizado com sucesso!');
      await carregarDados();
      setPreparoModal({ ...preparoModal, rendimento_receita: rendNum });
    }
  }

  async function handleSalvarEdicao(idItem: string) {
    const qtdNum = Number(editQtd.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      alert('Quantidade inválida.');
      return;
    }
    
    const { error } = await supabase.from('preparo_itens').update({ quantidade: qtdNum }).eq('id', idItem);
    
    if (error) {
      alert('Erro ao editar: ' + error.message);
    } else {
      setEditandoItemId(null);
      await carregarDados();
    }
  }

  function iniciarEdicao(item: ItemPreparo) {
    setEditandoItemId(item.id);
    setEditQtd(String(item.quantidade).replace('.', ','));
  }

  return (
    <>
      <TopBar titulo="Preparo de Molhos e Sub-receitas" />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }

        .tabela-fichas { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 650px; }
        .tabela-fichas th { padding: 16px 12px; font-weight: 500; color: var(--dim); border-bottom: 1px solid var(--line); }
        .tabela-fichas td { padding: 16px 12px; border-bottom: 1px solid var(--line); }
        .btn-ficha { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; display: inline-block; white-space: nowrap; }

        /* Estilos Inteligentes do Modal (Responsivo) */
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
        <div className="lbl">Novo Preparo</div>
        <div className="panel" style={{ padding: '16px', marginBottom: '8px' }}>
          <form onSubmit={handleCriarPreparo} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Nome (ex: Molho da Casa)</label>
              <input type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Medida</label>
              <select value={novaMedida} onChange={(e) => setNovaMedida(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}>
                {['kg', 'g', 'L', 'ml', 'un'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Rendimento do lote</label>
              <input type="text" inputMode="decimal" value={novoRendimento} onChange={(e) => setNovoRendimento(e.target.value)} placeholder="Ex: 2,5" required style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
            </div>
            <button type="submit" disabled={criando} style={{ padding: '12px 16px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              {criando ? 'Criando...' : '+ Criar'}
            </button>
          </form>
        </div>

        <div className="lbl">Controle de Insumos Produzidos Internamente</div>

        {carregando ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>Carregando o caderno de receitas...</div>
        ) : (
          <div className="panel custom-scroll" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="tabela-fichas">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ paddingLeft: '20px' }}>Insumo (Receita)</th>
                  <th>Rend. Lote</th>
                  <th>Custo do Lote</th>
                  <th>Custo Base (1{preparos[0]?.unidade_medida || 'g'})</th>
                  <th style={{ paddingRight: '20px', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {preparos.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--dim)' }}>Nenhum preparo cadastrado. Crie o primeiro acima e depois monte a receita.</td></tr>
                )}
                {preparos.map((prep) => {
                  const composicao = itensPreparo.filter((item) => item.insumo_pai_id === prep.id);
                  const temReceita = composicao.length > 0;

                  const custoMateriaPrima = composicao.reduce((acc, item) => {
                    const cMedio = Number(item.ingredientes?.custo_medio || 0);
                    return acc + Number(item.quantidade) * cMedio;
                  }, 0);

                  const custoFixo = Number(prep.custo_fixo ?? prep.custo_salao ?? 1.50);
                  const custoLoteTotal = custoMateriaPrima + custoFixo;

                  const rendimento = Number(prep.rendimento_receita || 1);
                  const custoCalculadoPorUnidade = rendimento > 0 ? custoLoteTotal / rendimento : 0;

                  return (
                    <tr
                      key={prep.id}
                      onClick={() => { setPreparoModal(prep); setRendimentoInput(String(prep.rendimento_receita || 1)); }}
                      style={{ cursor: 'pointer', transition: 'background 0.2s', borderLeft: temReceita ? '4px solid var(--grn)' : '4px solid var(--gold)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surf)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ paddingLeft: '20px', color: 'var(--txt)' }}><b style={{ fontSize: 15, display: 'block' }}>{prep.nome}</b></td>
                      <td style={{ color: 'var(--txt)' }}>{num(rendimento, 2)} {prep.unidade_medida}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{brl(custoLoteTotal)}</td>
                      <td style={{ color: 'var(--txt)', fontWeight: 'bold' }}>{brl(custoCalculadoPorUnidade)} <span style={{fontSize: 11, color: 'var(--dim)', fontWeight: 'normal'}}>/ {prep.unidade_medida}</span></td>
                      <td style={{ paddingRight: '20px', textAlign: 'right' }}>
                        {temReceita ? <span className="btn-ficha" style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--grn)' }}>Ver Receita</span> : <span className="btn-ficha" style={{ background: 'var(--rdim)', color: 'var(--red)' }}>⚠️ Montar</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO DA SUB-RECEITA */}
      {preparoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="panel custom-scroll" style={{ width: '100%', maxWidth: '700px', padding: '24px', borderRadius: '12px', background: 'var(--bg)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--txt)', fontSize: '20px' }}>Ficha de Preparo</h3>
                <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{preparoModal.nome}</div>
              </div>
              <button onClick={() => { setPreparoModal(null); setEditandoItemId(null); }} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '24px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'var(--surf)', padding: '16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--dim)' }}>Rendimento do Lote ({preparoModal.unidade_medida})</label>
                <input type="text" value={rendimentoInput} onChange={(e) => setRendimentoInput(e.target.value)} style={{ width: '100%', padding: '10px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '6px', outline: 'none' }} />
              </div>
              <button onClick={handleAtualizarRendimento} style={{ padding: '10px 16px', background: 'var(--line)', color: 'var(--txt)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Rendimento</button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', color: 'var(--dim)', marginBottom: '12px', fontWeight: 'bold' }}>Ingredientes Utilizados</div>
              <div style={{ background: 'var(--surf)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <table className="modal-table">
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Qtd Receita</th>
                      <th className="hide-mobile">Custo UND</th>
                      <th>Custo Total</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPreparo.filter((i) => i.insumo_pai_id === preparoModal.id).length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--gold)' }}>Nenhuma matéria-prima vinculada.</td></tr>
                    ) : (
                      itensPreparo.filter((i) => i.insumo_pai_id === preparoModal.id).map((item) => {
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
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Selecionar Matéria-Prima</label>
                {/* CAMPO DE BUSCA E SELEÇÃO INTELIGENTE (DATALIST) */}
                <input 
                  list="lista-ingredientes-brutos" 
                  value={ingredienteBusca} 
                  onChange={(e) => setIngredienteBusca(e.target.value)} 
                  placeholder="Digite ou selecione..."
                  style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} 
                  required 
                />
                <datalist id="lista-ingredientes-brutos">
                  {ingredientesBrutos.map((ing) => (
                    <option key={ing.id} value={ing.nome} />
                  ))}
                </datalist>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--dim)', marginBottom: 6 }}>Qtd de Uso</label>
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