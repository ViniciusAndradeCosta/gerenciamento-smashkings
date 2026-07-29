'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';

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
  
  // Estado para armazenar qual unidade foi selecionada
  const [unidadeSelecionada, setUnidadeSelecionada] = useState('');

  // Define a primeira unidade da lista (ou a "Geral") como padrão assim que a tela carrega
  useEffect(() => {
    if (unidades.length > 0 && !unidadeSelecionada) {
      const unidadeGeral = unidades.find(u => u.codigo === 'geral');
      setUnidadeSelecionada(unidadeGeral ? unidadeGeral.id : unidades[0].id);
    }
  }, [unidades]);

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
    setItensExtraidos(itensExtraidos.filter(item => item.id_temp !== id_temp));
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
          unidade_id: unidadeSelecionada, // Agora envia o ID da unidade que você escolher na tela
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
      {itensExtraidos.length === 0 && (
        <form onSubmit={extrairDados} className="field">
          
          {/* NOVO SELETOR DE UNIDADES */}
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
              📁 Escolher Arquivo
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
            {carregando ? 'Lendo nota com IA (Aguarde)...' : 'Extrair Produtos da Nota'}
          </button>
        </form>
      )}

      {itensExtraidos.length > 0 && (
        <div style={{ marginTop: 15 }}>
          <div className="lbl" style={{ margin: '0 0 10px 0' }}>Revise os itens lidos</div>
          
          {itensExtraidos.map(item => (
            <div key={item.id_temp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottom: '1px solid var(--line)', paddingBottom: 15 }}>
              <div>
                <b style={{ color: 'var(--txt)' }}>{item.nome}</b> <br/>
                <small style={{ color: 'var(--gold)' }}>{item.quantidade} {item.unidade_medida} - Total: {brl(item.preco_total)}</small>
              </div>
              
              <button 
                onClick={() => removerItem(item.id_temp)} 
                style={{ background: 'var(--rdim)', color: 'var(--red)', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
              >
                Apagar
              </button>
            </div>
          ))}
          
          <button onClick={salvarNoBanco} className="btn prim" disabled={carregando} style={{ marginTop: 15, width: '100%' }}>
            {carregando ? 'Salvando no Estoque...' : 'Confirmar e Salvar Tudo'}
          </button>
        </div>
      )}
    </div>
  );
}