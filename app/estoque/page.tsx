'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { brl, num } from '@/lib/format';

type Unidade = { id: string; nome: string; codigo?: string; cor?: string };
type Ingrediente = { id: string; nome: string; unidade_medida: string; custo_medio: number; e_produzido_internamente: boolean; estoque_minimo?: number };
type Estoque = { unidade_id: string; ingrediente_id: string; quantidade: number };

export default function EstoquePage() {
  const supabase = createClient();
  
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados dos Filtros
  const [unidadeFiltro, setUnidadeFiltro] = useState('Todas');
  const [tipoFiltro, setTipoFiltro] = useState('Brutos'); 

  // Estados de Edição Inline
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState(''); 
  const [editQtdsUnidades, setEditQtdsUnidades] = useState<Record<string, string>>({}); 
  const [editMinimo, setEditMinimo] = useState(''); // Novo: Estoque Mínimo
  const [salvando, setSalvando] = useState(false);

  async function carregarDados() {
    setCarregando(true);
    const [resUni, resIng, resEst] = await Promise.all([
      supabase.from('unidades').select('*').order('nome'),
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('estoque').select('*')
    ]);

    if (resUni.data) setUnidades(resUni.data);
    if (resIng.data) setIngredientes(resIng.data);
    if (resEst.data) setEstoques(resEst.data);
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  function iniciarEdicao(ingrediente: Ingrediente, qtdAtual: number) {
    setEditandoItemId(ingrediente.id);
    setEditMinimo(String(ingrediente.estoque_minimo || 0).replace('.', ','));
    
    if (unidadeFiltro === 'Todas') {
      const mapQtds: Record<string, string> = {};
      unidades.forEach(u => {
        const est = estoques.find(e => e.ingrediente_id === ingrediente.id && e.unidade_id === u.id);
        mapQtds[u.id] = String(est ? est.quantidade : 0).replace('.', ',');
      });
      setEditQtdsUnidades(mapQtds);
    } else {
      setEditQtd(String(qtdAtual).replace('.', ','));
    }
  }

  async function salvarAjuste(ingredienteId: string) {
    setSalvando(true);

    try {
      // 1. Salva o Estoque Mínimo de Alerta no Ingrediente
      const minVal = Number(editMinimo.replace(',', '.'));
      if (!isNaN(minVal) && minVal >= 0) {
        await supabase.from('ingredientes').update({ estoque_minimo: minVal }).eq('id', ingredienteId);
      }

      // 2. Salva as quantidades nas Unidades
      if (unidadeFiltro === 'Todas') {
        for (const u of unidades) {
          const valStr = editQtdsUnidades[u.id] || '0';
          const val = Number(valStr.replace(',', '.'));
          if (isNaN(val) || val < 0) continue;

          const match = estoques.find(e => e.unidade_id === u.id && e.ingrediente_id === ingredienteId);
          if (match) {
            await supabase.from('estoque').update({ quantidade: val }).eq('unidade_id', u.id).eq('ingrediente_id', ingredienteId);
          } else {
            await supabase.from('estoque').insert({ unidade_id: u.id, ingrediente_id: ingredienteId, quantidade: val });
          }
        }
      } else {
        const val = Number(editQtd.replace(',', '.'));
        if (isNaN(val) || val < 0) {
          alert('Digite uma quantidade válida.');
          setSalvando(false);
          return;
        }

        const match = estoques.find(e => e.unidade_id === unidadeFiltro && e.ingrediente_id === ingredienteId);
        if (match) {
          await supabase.from('estoque').update({ quantidade: val }).eq('unidade_id', unidadeFiltro).eq('ingrediente_id', ingredienteId);
        } else {
          await supabase.from('estoque').insert({ unidade_id: unidadeFiltro, ingrediente_id: ingredienteId, quantidade: val });
        }
      }

      setEditandoItemId(null);
      await carregarDados();
    } catch (err: any) {
      alert('Erro ao salvar estoque: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  const ingredientesFiltrados = ingredientes.filter(ing => {
    if (tipoFiltro === 'Preparos') return ing.e_produzido_internamente === true;
    return !ing.e_produzido_internamente;
  });

  return (
    <>
      <TopBar titulo="Estoque de Insumos" />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }

        .scroll-chips { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
        .scroll-chips::-webkit-scrollbar { display: none; }
        
        .chip { padding: 8px 16px; white-space: nowrap; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; }
        .chip.act { background: var(--gold); color: #000; font-weight: bold; border: none; }
        .chip.inac { background: var(--surf); color: var(--txt); border: 1px solid var(--line); }

        .dot-unidade { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

        .tabela-estoque { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; min-width: 600px; }
        .tabela-estoque th { padding: 16px 12px; font-weight: 500; color: var(--dim); border-bottom: 1px solid var(--line); }
        .tabela-estoque td { padding: 16px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; }

        .modal-input { background: var(--bg); border: 1px solid var(--gold); color: var(--txt); border-radius: 4px; outline: none; padding: 6px; width: 100%; box-sizing: border-box; text-align: center; }
        .btn-sm { padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; border: none; font-size: 12px; }
        .btn-sm.gold { background: var(--gold); color: #000; }
        .btn-sm.surf { background: var(--surf); color: var(--txt); border: 1px solid var(--line); }

        .qtd-wrap { display: flex; gap: 4px; align-items: center; }
        .action-cell { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        
        .badge-status { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; margin-left: 8px; white-space: nowrap; }

        @media (max-width: 768px) {
          .tabela-estoque { font-size: 12px; min-width: 100%; }
          .tabela-estoque th, .tabela-estoque td { padding: 12px 6px; font-size: 11px; }
          .hide-mobile { display: none; }
          .modal-input { padding: 6px 2px; font-size: 11px; }
          .btn-sm { padding: 6px 6px; font-size: 10px; flex: 1; text-align: center; }
          .qtd-wrap { flex-direction: column; align-items: stretch; gap: 2px; }
          .action-cell { flex-direction: column; align-items: stretch; gap: 4px; }
          .badge-status { margin-left: 0; margin-top: 6px; }
        }
      `}} />

      <div className="wrap">
        <div className="lbl" style={{ marginBottom: '16px' }}>Visão Geral do Estoque</div>

        {/* FILTROS */}
        <div className="scroll-chips">
          <button onClick={() => setUnidadeFiltro('Todas')} className={`chip ${unidadeFiltro === 'Todas' ? 'act' : 'inac'}`}>
            Todas
          </button>
          {unidades.map(u => (
            <button key={u.id} onClick={() => setUnidadeFiltro(u.id)} className={`chip ${unidadeFiltro === u.id ? 'act' : 'inac'}`}>
              <span className="dot-unidade" style={{ background: u.cor || 'var(--gold)' }} />
              {u.nome}
            </button>
          ))}
        </div>

        <div className="scroll-chips" style={{ marginBottom: '24px' }}>
          <button onClick={() => setTipoFiltro('Brutos')} className={`chip ${tipoFiltro === 'Brutos' ? 'act' : 'inac'}`}>
            Insumos Brutos
          </button>
          <button onClick={() => setTipoFiltro('Preparos')} className={`chip ${tipoFiltro === 'Preparos' ? 'act' : 'inac'}`}>
            Preparos / Sub-receitas
          </button>
        </div>

        {carregando ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>Carregando estoque...</div>
        ) : (
          <div className="panel custom-scroll" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="tabela-estoque">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ paddingLeft: '20px' }}>Insumo / Produto</th>
                  <th>Estoque Atual</th>
                  <th className="hide-mobile">Custo Médio</th>
                  <th>Valor em Estoque</th>
                  <th style={{ paddingRight: '20px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ingredientesFiltrados.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--dim)' }}>Nenhum insumo encontrado.</td></tr>
                ) : (
                  ingredientesFiltrados.map(ing => {
                    const estoquesDoIngrediente = estoques.filter(e => e.ingrediente_id === ing.id);
                    
                    // Cálculo do estoque geral (Soma de tudo) e do estoque visível (Filtro)
                    const qtdGeralTotal = estoquesDoIngrediente.reduce((acc, e) => acc + (Number(e.quantidade) || 0), 0);
                    let qtdAtual = 0;

                    if (unidadeFiltro === 'Todas') {
                      qtdAtual = qtdGeralTotal;
                    } else {
                      const estUni = estoquesDoIngrediente.find(e => e.unidade_id === unidadeFiltro);
                      if (estUni) qtdAtual = Number(estUni.quantidade);
                    }

                    // A LÓGICA CORRIGIDA DO STATUS ESTÁ AQUI
                    const minimo = Number(ing.estoque_minimo || 0);
                    let statusColor = '';
                    let statusText = '';
                    
                    if (qtdGeralTotal <= 0) {
                      statusColor = 'var(--red)';
                      statusText = 'Esgotado';
                    } else if (minimo > 0 && qtdGeralTotal <= minimo) {
                      statusColor = 'var(--gold)';
                      statusText = 'Acabando';
                    } else {
                      // Se tem mais de zero e não bateu no mínimo, tá tudo certo
                      statusColor = 'var(--grn)';
                      statusText = 'Normal';
                    }

                    const custo = Number(ing.custo_medio || 0);
                    const isEditing = editandoItemId === ing.id;

                    return (
                      <tr key={ing.id} style={{ background: isEditing ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.2s' }}>
                        
                        {/* COLUNA NOME */}
                        <td style={{ paddingLeft: '20px', color: 'var(--txt)' }}>
                          <b style={{ fontSize: 15, display: 'block' }}>{ing.nome}</b>
                        </td>

                        {/* COLUNA ESTOQUE E STATUS */}
                        <td style={{ color: 'var(--txt)' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              
                              {/* Edição de Quantidades */}
                              {unidadeFiltro === 'Todas' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {unidades.map(u => (
                                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span className="dot-unidade" style={{ background: u.cor || 'var(--gold)' }} />
                                      <span style={{ fontSize: '12px', color: 'var(--txt)', minWidth: '70px' }}>{u.nome}:</span>
                                      <input type="text" className="modal-input" value={editQtdsUnidades[u.id] || '0'} onChange={(e) => setEditQtdsUnidades({ ...editQtdsUnidades, [u.id]: e.target.value })} style={{ width: '70px' }} />
                                      <span style={{ fontSize: '11px', color: 'var(--dim)' }}>{ing.unidade_medida}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="qtd-wrap">
                                  <input type="text" className="modal-input" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} autoFocus style={{ width: '80px' }} />
                                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>{ing.unidade_medida}</span>
                                </div>
                              )}

                              {/* Definição do Alerta Mínimo */}
                              <div style={{ paddingTop: '8px', borderTop: '1px dashed var(--line)' }}>
                                <span style={{ fontSize: '11px', color: 'var(--gold)', display: 'block', marginBottom: '4px' }}>Alerta de Mínimo:</span>
                                <div className="qtd-wrap">
                                  <input type="text" className="modal-input" value={editMinimo} onChange={(e) => setEditMinimo(e.target.value)} style={{ width: '80px', borderColor: 'var(--dim)' }} placeholder="Ex: 5" />
                                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>{ing.unidade_medida}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                                {num(qtdAtual, 3)} <span style={{ fontSize: '11px', color: 'var(--dim)', fontWeight: 'normal' }}>{ing.unidade_medida}</span>
                              </span>
                              
                              {/* BADGE DE STATUS */}
                              <span className="badge-status" style={{ border: `1px solid ${statusColor}`, color: statusColor, background: 'rgba(255,255,255,0.05)' }}>
                                {statusText}
                              </span>
                              
                              {/* BADGES POR UNIDADE */}
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {unidadeFiltro === 'Todas' ? (
                                  estoquesDoIngrediente.map(est => {
                                    const u = unidades.find(uni => uni.id === est.unidade_id);
                                    if (!u || Number(est.quantidade) <= 0) return null;
                                    return (
                                      <span key={est.unidade_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: 'var(--surf)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                                        <span className="dot-unidade" style={{ background: u.cor || 'var(--gold)' }} />
                                        <b style={{ color: 'var(--txt)' }}>{u.nome}:</b> {num(est.quantidade, 2)} {ing.unidade_medida}
                                      </span>
                                    );
                                  })
                                ) : (
                                  (() => {
                                    const u = unidades.find(uni => uni.id === unidadeFiltro);
                                    return u ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', background: 'var(--surf)', padding: '3px 8px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                                        <span className="dot-unidade" style={{ background: u.cor || 'var(--gold)' }} />
                                        {u.nome}
                                      </span>
                                    ) : null;
                                  })()
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="hide-mobile" style={{ color: 'var(--dim)' }}>
                          {brl(custo)}
                        </td>
                        
                        <td style={{ color: 'var(--txt)', fontWeight: 'bold' }}>
                          {brl(qtdAtual * custo)}
                        </td>

                        <td style={{ paddingRight: '20px', textAlign: 'right', verticalAlign: 'top' }}>
                          <div className="action-cell">
                            {isEditing ? (
                              <>
                                <button onClick={() => salvarAjuste(ing.id)} disabled={salvando} className="btn-sm gold">
                                  {salvando ? '...' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditandoItemId(null)} className="btn-sm surf">✕</button>
                              </>
                            ) : (
                              <button onClick={() => iniciarEdicao(ing, qtdAtual)} className="btn-sm surf">Ajustar</button>
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
        )}
      </div>
    </>
  );
}