'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };

export default function CompraForm({
  unidades, ingredientes, fornecedores, unidadeInicial
}: {
  unidades: Opt[]; ingredientes: Opt[]; fornecedores: Opt[]; unidadeInicial?: string;
}) {
  const [unidade, setUnidade] = useState(unidadeInicial || unidades[0]?.id || '');
  const [ingrediente, setIngrediente] = useState(ingredientes[0]?.id || '');
  
  // O estado do fornecedor agora guarda um texto (o nome), e não mais o ID diretamente
  const [fornecedorInput, setFornecedorInput] = useState('');
  
  const [quantidade, setQuantidade] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Busca a unidade de medida do ingrediente selecionado para mostrar na label
  const ingSelecionado = ingredientes.find(i => i.id === ingrediente);
  const siglaMedida = ingSelecionado?.unidade_medida || 'UN';

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const supabase = createClient();
    
    try {
      let idDoFornecedor = null;
      
      // Se o usuário digitou algum fornecedor, vamos verificar
      if (fornecedorInput.trim() !== '') {
        const fornecedorExistente = fornecedores.find(
          f => f.nome.toLowerCase().trim() === fornecedorInput.toLowerCase().trim()
        );

        if (fornecedorExistente) {
          // Já existe, pega o ID dele
          idDoFornecedor = fornecedorExistente.id;
        } else {
          // Não existe, cria um novo na hora na tabela 'fornecedores'
          const { data: novoForn, error: erroForn } = await supabase
            .from('fornecedores')
            .insert({ nome: fornecedorInput.trim() })
            .select('id')
            .single();
            
          if (erroForn) throw new Error("Erro ao criar novo fornecedor: " + erroForn.message);
          idDoFornecedor = novoForn.id;
        }
      }

      // Salva a compra (lembrando que enviamos o preco_unitario para o banco calcular o total)
      const { error: erroCompra } = await supabase
        .from('compras')
        .insert({
          unidade_id: unidade,
          ingrediente_id: ingrediente,
          fornecedor_id: idDoFornecedor, // Envia o ID (novo, antigo, ou null se deixou vazio)
          quantidade: Number(quantidade),
          preco_unitario: Number(precoUnitario.replace(',', '.'))
        });

      if (erroCompra) throw new Error("Erro ao salvar compra: " + erroCompra.message);
      
      alert("Compra registrada com sucesso!");
      
      // Limpa os campos para o próximo lançamento
      setQuantidade('');
      setPrecoUnitario('');
      setFornecedorInput('');
      window.location.reload();
      
    } catch (err: any) {
      alert(err.message);
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      <div className="field" style={{ marginBottom: 15 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Unidade</label>
        <select 
          value={unidade} 
          onChange={(e) => setUnidade(e.target.value)}
          style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
          required
        >
          {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 15 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Ingrediente</label>
        <select 
          value={ingrediente} 
          onChange={(e) => setIngrediente(e.target.value)}
          style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
          required
        >
          {ingredientes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 15 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Fornecedor</label>
        
        {/* CAMPO HÍBRIDO: Input de texto amarrado a um Datalist */}
        <input 
          list="lista-fornecedores" 
          value={fornecedorInput} 
          onChange={(e) => setFornecedorInput(e.target.value)}
          placeholder="— opcional — (Selecione ou digite um novo)"
          style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
        />
        <datalist id="lista-fornecedores">
          {fornecedores.map(f => (
            <option key={f.id} value={f.nome} />
          ))}
        </datalist>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
        <div className="field">
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Quantidade ({siglaMedida})</label>
          <input 
            type="number" 
            step="0.01" 
            min="0"
            value={quantidade} 
            onChange={(e) => setQuantidade(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
            required 
          />
        </div>
        <div className="field">
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Preço unit. (R$)</label>
          <input 
            type="number" 
            step="0.01" 
            min="0"
            value={precoUnitario} 
            onChange={(e) => setPrecoUnitario(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
            required 
          />
        </div>
      </div>

      <button type="submit" className="btn prim" disabled={carregando} style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
        {carregando ? 'Registrando...' : '+ Registrar compra'}
      </button>
    </form>
  );
}