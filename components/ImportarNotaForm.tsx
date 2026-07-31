'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl, num } from '@/lib/format';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };
type ItemNF = { id_temp: string; nome: string; quantidade: number; preco_total: number; unidade_medida: string; ingrediente_id?: string };

export default function ImportarNotaForm({
  unidades, ingredientes
}: {
  unidades: Opt[]; ingredientes: Opt[];
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [itensExtraidos, setItensExtraidos] = useState<ItemNF[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  const [unidadeSelecionada, setUnidadeSelecionada] = useState('');

  // --- ESTADOS PARA EDIÇÃO INLINE DA NOTA FISCAL ---
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editQtd, setEditQtd] = useState('');
  const [editPreco, setEditPreco] = useState('');
  const [editUnidade, setEditUnidade] = useState('');

  useEffect(() => {
    if (unidades.length > 0 && !unidadeSelecionada) {
      const unidadePadrao = unidades.find(u => u.codigo === 'producao' || u.codigo === 'geral' || u.nome.toLowerCase().includes('produção'));
      setUnidadeSelecionada(unidadePadrao ? unidadePadrao.id : unidades[0].id);
    }
  }, [unidades, unidadeSelecionada]);

  async function extrairDados(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    
    setCarregando(true);
    const formData = new FormData();
    formData.append('file', arquivo);

    try {
      const res = await fetch('/api/extrair-nf', { method: 'POST', body: formData });
      const dadosIA = await res.json();
      
      if (!res.ok || dadosIA.error) {
        throw new Error(dadosIA.detalhe || dadosIA.error || 'Falha na comunicação com o servidor');
      }
      
      setItensExtraidos(dadosIA);
    } catch (error: any) {
      alert("Motivo do erro: " + error.message);
      console.error(error);
    } finally {
      setCarregando(false);
    }
  }

  function removerItem(id_temp: string) {
    if (!confirm('Deseja remover este item da lista de importação?')) return;
    setItensExtraidos(itensExtraidos.filter(item => item.id_temp !== id_temp));
  }

  // --- FUNÇÕES DE EDIÇÃO DA TABELA ---
  function iniciarEdicaoItem(item: ItemNF) {
    setEditandoItemId(item.id_temp);
    setEditNome(item.nome);
    setEditQtd(String(item.quantidade).replace('.', ','));
    setEditPreco(String(item.preco_total).replace('.', ','));
    setEditUnidade(item.unidade_medida || 'UN');
  }

  function salvarEdicaoItem(id_temp: string) {
    const qtdNum = Number(editQtd.replace(',', '.'));
    const precoNum = Number(editPreco.replace(',', '.'));

    if (!editNome.trim() || isNaN(qtdNum) || isNaN(precoNum)) {
      alert('Por favor, preencha os campos com valores numéricos válidos.');
      return;
    }

    const novaLista = itensExtraidos.map(item => {
      if (item.id_temp === id_temp) {
        return { 
          ...item, 
          nome: editNome.trim(), 
          quantidade: qtdNum, 
          preco_total: precoNum,
          unidade_medida: editUnidade.trim().toUpperCase() 
        };
      }
      return item;
    });

    setItensExtraidos(novaLista);
    setEditandoItemId(null);
  }

  async function salvarNoBanco() {
    setCarregando(true);
    const supabase = createClient();
    let quantidadeErros = 0;
    
    for (const item of itensExtraidos) {
      let idDoIngrediente = null;

      const ingredienteExistente = ingredientes.find(
        (ing) => ing.nome.toLowerCase().trim() === item.nome.toLowerCase().trim()
      );

      if (ingredienteExistente) {
        idDoIngrediente = ingredienteExistente.id;
      } else {
        const { data: novoIngrediente, error: erroCriarIngrediente } = await supabase
          .from('ingredientes')
          .insert({
            nome: item.nome, 
            unidade_medida: item.unidade_medida || 'UN',
            ativo: true
          })
          .select('id')
          .single(); 

        if (erroCriarIngrediente) {
          console.error(`Erro ao criar o ingrediente ${item.nome}:`, erroCriarIngrediente);
          quantidadeErros++;
          continue; 
        }
        
        idDoIngrediente = novoIngrediente.id;
      }

      const precoUnitarioCalculado = item.preco_total / (item.quantidade || 1);

      const { error: erroCompra } = await supabase
        .from('compras')
        .insert({
          unidade_id: unidadeSelecionada,
          ingrediente_id: idDoIngrediente,
          quantidade: item.quantidade,
          preco_unitario: precoUnitarioCalculado
        });

      if (erroCompra) {
        console.error(`Erro ao salvar a compra do item ${item.nome}:`, erroCompra);
        quantidadeErros++;
      }
    }
    
    setCarregando(false);
    
    if (quantidadeErros > 0) {
      alert(`Processo concluído, mas houve erro em ${quantidadeErros} itens. Verifique o console.`);
    } else {
      alert("Todos os ingredientes e compras foram registrados com sucesso!");
      setItensExtraidos([]); 
      setArquivo(null);
      window.location.reload(); 
    }
  }

  return (
    <div>
      {/* Estilos Responsivos para fazer a tabela caber na tela do celular */}
      <style dangerouslySetInnerHTML={{__html: `
        .nf-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
        .nf-table th { padding: 12px; color: var(--dim); border-bottom: 1px solid var(--line); font-weight: normal; }
        .nf-table td { padding: 12px; border-bottom: 1px solid var(--line); color: var(--txt); }
        
        /* Inputs de Edição */
        .nf-input { background: var(--bg); border: 1px solid var(--gold); color: var(--txt); border-radius: 4px; outline: none; padding: 8px; width: 100%; box-sizing: border-box; }
        
        /* Botões de Ação da Tabela */
        .btn-nf { padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; border: none; font-size: 12px; margin-right: 6px; }
        .btn-nf.gold { background: var(--gold); color: #000; }
        .btn-nf.surf { background: var(--surf); color: var(--txt); border: 1px solid var(--line); }
        .btn-nf.red { background: var(--rdim); color: var(--red); margin-right: 0; }
        
        .qtd-wrap { display: flex; gap: 4px; align-items: center; }

        /* Ajustes para Celular (telas menores que 768px) */
        @media (max-width: 768px) {
          .nf-table { font-size: 11px; }
          .nf-table th, .nf-table td { padding: 8px 4px; }
          .nf-input { padding: 6px 4px; font-size: 11px; }
          .btn-nf { padding: 6px 6px; font-size: 10px; margin-right: 4px; }
          .hide-mobile { display: none; }
          
          /* No celular, coloca o Input de Qtd e Unidade um debaixo do outro pra não estourar a tela */
          .qtd-wrap { flex-direction: column; align-items: stretch; gap: 2px; }
        }
      `}} />

      {itensExtraidos.length === 0 && (
        <form onSubmit={extrairDados} className="field">
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>
              Para qual estoque essa nota será lançada?
            </label>
            <select 
              value={unidadeSelecionada} 
              onChange={(e) => setUnidadeSelecionada(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
            >
              {unidades.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <label>Como deseja enviar a nota fiscal?</label>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 10, marginBottom: 15 }}>
            <label className="btn" style={{ flex: 1, textAlign: 'center', cursor: 'pointer', background: 'var(--surf)', border: '1px solid var(--line)', padding: '12px 0' }}>
              📷 Tirar Foto
              <input 
                type="file" 
                accept="image/*"
                capture="environment" 
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} 
                style={{ display: 'none' }}
              />
            </label>

            <label className="btn" style={{ flex: 1, textAlign: 'center', cursor: 'pointer', background: 'var(--surf)', border: '1px solid var(--line)', padding: '12px 0' }}>
              📁 Arquivo
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} 
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {arquivo && (
            <div style={{ marginBottom: 15, fontSize: 14, color: 'var(--gold)', textAlign: 'center' }}>
              ✅ Selecionado: {arquivo.name === 'image.jpg' ? 'Foto da câmera' : arquivo.name}
            </div>
          )}

          <button type="submit" className="btn prim" disabled={carregando || !arquivo} style={{ width: '100%' }}>
            {carregando ? 'Lendo nota com IA (Aguarde)...' : 'Extrair Produtos'}
          </button>
        </form>
      )}

      {itensExtraidos.length > 0 && (
        <div style={{ marginTop: 15 }}>
          <div className="lbl" style={{ margin: '0 0 10px 0' }}>Revise os itens lidos ({itensExtraidos.length})</div>
          
          <div style={{ background: 'var(--surf)', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <table className="nf-table">
              <thead>
                <tr>
                  <th>Produto Extraído</th>
                  <th>Qtd</th>
                  <th>Preço<span className="hide-mobile"> (R$)</span></th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itensExtraidos.map((item) => {
                  const isEditing = editandoItemId === item.id_temp;

                  return (
                    <tr key={item.id_temp} style={{ background: isEditing ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                      
                      {/* NOME DO PRODUTO */}
                      <td>
                        {isEditing ? (
                          <input 
                            type="text" 
                            className="nf-input"
                            value={editNome} 
                            onChange={(e) => setEditNome(e.target.value)} 
                            autoFocus 
                          />
                        ) : (
                          <b>{item.nome}</b>
                        )}
                      </td>
                      
                      {/* QUANTIDADE E UNIDADE DE MEDIDA */}
                      <td>
                        {isEditing ? (
                          <div className="qtd-wrap">
                            <input 
                              type="text" 
                              className="nf-input"
                              value={editQtd} 
                              onChange={(e) => setEditQtd(e.target.value)} 
                              style={{ textAlign: 'center' }} 
                            />
                            <input 
                              type="text" 
                              className="nf-input"
                              value={editUnidade} 
                              onChange={(e) => setEditUnidade(e.target.value)} 
                              placeholder="UN"
                              style={{ textAlign: 'center' }} 
                            />
                          </div>
                        ) : (
                          <span>{num(item.quantidade, 2)} <span style={{fontSize: '10px', color: 'var(--dim)'}}>{item.unidade_medida}</span></span>
                        )}
                      </td>

                      {/* PREÇO TOTAL */}
                      <td>
                        {isEditing ? (
                          <input 
                            type="text" 
                            className="nf-input"
                            value={editPreco} 
                            onChange={(e) => setEditPreco(e.target.value)} 
                          />
                        ) : (
                          <span style={{ fontWeight: 'bold' }}>{brl(item.preco_total)}</span>
                        )}
                      </td>
                      
                      {/* BOTÕES DE AÇÃO */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => salvarEdicaoItem(item.id_temp)} className="btn-nf gold">Salvar</button>
                            <button onClick={() => setEditandoItemId(null)} className="btn-nf surf" style={{ marginRight: 0 }}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicaoItem(item)} className="btn-nf surf">Editar</button>
                            <button onClick={() => removerItem(item.id_temp)} className="btn-nf red">Remover</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <button 
            onClick={salvarNoBanco} 
            className="btn prim" 
            disabled={carregando || editandoItemId !== null} 
            style={{ marginTop: 15, width: '100%', opacity: editandoItemId !== null ? 0.5 : 1 }}
          >
            {carregando ? 'Salvando no Estoque...' : 'Confirmar e Salvar Tudo'}
          </button>

          {editandoItemId !== null && (
            <div style={{ fontSize: '12px', color: 'var(--gold)', textAlign: 'center', marginTop: '8px' }}>
              ⚠️ Salve o item que está editando para poder finalizar a importação.
            </div>
          )}
        </div>
      )}
    </div>
  );
}