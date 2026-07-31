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
  
  // Agora o estado guarda o texto digitado/selecionado do ingrediente
  const [ingredienteInput, setIngredienteInput] = useState('');
  
  // O estado do fornecedor guarda o texto digitado/selecionado
  const [fornecedorInput, setFornecedorInput] = useState('');
  
  const [quantidade, setQuantidade] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Descobre a unidade de medida se o ingrediente já existir na lista
  const ingEncontrado = ingredientes.find(i => i.nome.toLowerCase().trim() === ingredienteInput.toLowerCase().trim());
  const siglaMedida = ingEncontrado?.unidade_medida || 'UN';

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!ingredienteInput.trim()) {
      alert('Por favor, informe o ingrediente.');
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    
    try {
      let idDoIngrediente = null;
      let idDoFornecedor = null;
      
      // 1. GERENCIAMENTO DO INGREDIENTE (Busca ou Cria Automaticamente)
      const ingredienteExistente = ingredientes.find(
        i => i.nome.toLowerCase().trim() === ingredienteInput.toLowerCase().trim()
      );

      if (ingredienteExistente) {
        idDoIngrediente = ingredienteExistente.id;
      } else {
        // Se o ingrediente não existe, cria um novo na tabela 'ingredientes'
        const { data: novoIng, error: erroIng } = await supabase
          .from('ingredientes')
          .insert({ 
            nome: ingredienteInput.trim(), 
            unidade_medida: 'UN', // Padrão inicial caso seja criado manualmente
            ativo: true 
          })
          .select('id')
          .single();
          
        if (erroIng) throw new Error("Erro ao criar novo ingrediente: " + erroIng.message);
        idDoIngrediente = novoIng.id;
      }

      // 2. GERENCIAMENTO DO FORNECEDOR (Busca ou Cria se preenchido)
      if (fornecedorInput.trim() !== '') {
        const fornecedorExistente = fornecedores.find(
          f => f.nome.toLowerCase().trim() === fornecedorInput.toLowerCase().trim()
        );

        if (fornecedorExistente) {
          idDoFornecedor = fornecedorExistente.id;
        } else {
          const { data: novoForn, error: erroForn } = await supabase
            .from('fornecedores')
            .insert({ nome: fornecedorInput.trim() })
            .select('id')
            .single();
            
          if (erroForn) throw new Error("Erro ao criar novo fornecedor: " + erroForn.message);
          idDoFornecedor = novoForn.id;
        }
      }

      // 3. SALVA A COMPRA
      const { error: erroCompra } = await supabase
        .from('compras')
        .insert({
          unidade_id: unidade,
          ingrediente_id: idDoIngrediente,
          fornecedor_id: idDoFornecedor,
          quantidade: Number(quantidade),
          preco_unitario: Number(precoUnitario.replace(',', '.'))
        });

      if (erroCompra) throw new Error("Erro ao salvar compra: " + erroCompra.message);
      
      alert("Compra registrada com sucesso!");
      
      // Limpa os campos para o próximo lançamento
      setQuantidade('');
      setPrecoUnitario('');
      setIngredienteInput('');
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

      {/* CAMPO HÍBRIDO DE INGREDIENTE (Digitar ou Selecionar) */}
      <div className="field" style={{ marginBottom: 15 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Ingrediente</label>
        <input 
          list="lista-ingredientes" 
          value={ingredienteInput} 
          onChange={(e) => setIngredienteInput(e.target.value)}
          placeholder="Selecione da lista ou digite um novo..."
          style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }}
          required
        />
        <datalist id="lista-ingredientes">
          {ingredientes.map(i => (
            <option key={i.id} value={i.nome} />
          ))}
        </datalist>
      </div>

      {/* CAMPO HÍBRIDO DE FORNECEDOR (Digitar ou Selecionar) */}
      <div className="field" style={{ marginBottom: 15 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--txt)' }}>Fornecedor</label>
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