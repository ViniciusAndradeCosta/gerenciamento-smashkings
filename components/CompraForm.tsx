'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { avisar } from './Toaster';
import { brl } from '@/lib/format';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };

const paraNumero = (s: string) => Number(String(s).replace(',', '.'));

export default function CompraForm({
  unidades, ingredientes, fornecedores, unidadeInicial,
}: {
  unidades: Opt[]; ingredientes: Opt[]; fornecedores: Opt[]; unidadeInicial?: string;
}) {
  const router = useRouter();
  const [unidade, setUnidade] = useState(unidadeInicial || unidades[0]?.id || '');
  const [ingredienteInput, setIngredienteInput] = useState('');
  const [fornecedorInput, setFornecedorInput] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [medidaNova, setMedidaNova] = useState('UN');
  const [carregando, setCarregando] = useState(false);

  // Descobre a unidade de medida se o ingrediente já existir na lista
  const ingEncontrado = ingredientes.find((i) => i.nome.toLowerCase().trim() === ingredienteInput.toLowerCase().trim());
  const ingredienteNovo = !ingEncontrado && ingredienteInput.trim() !== '';
  const siglaMedida = ingEncontrado?.unidade_medida || medidaNova;
  const totalPrevisto = paraNumero(quantidade) * paraNumero(precoUnitario);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const q = paraNumero(quantidade);
    const p = paraNumero(precoUnitario);
    if (!ingredienteInput.trim()) return avisar('Informe o insumo.', 'erro');
    if (!(q > 0)) return avisar('Informe uma quantidade maior que zero.', 'erro');
    if (isNaN(p) || p < 0) return avisar('Informe um preço válido.', 'erro');

    setCarregando(true);
    const supabase = createClient();

    try {
      let idDoIngrediente = ingEncontrado?.id || null;
      let idDoFornecedor = null;

      // 1. Insumo: usa o existente ou cria um novo
      if (!idDoIngrediente) {
        const { data: novoIng, error: erroIng } = await supabase
          .from('ingredientes')
          .insert({ nome: ingredienteInput.trim(), unidade_medida: medidaNova, ativo: true })
          .select('id')
          .single();
        if (erroIng) throw new Error('Erro ao criar novo insumo: ' + erroIng.message);
        idDoIngrediente = novoIng.id;
      }

      // 2. Fornecedor (opcional): usa o existente ou cria um novo
      if (fornecedorInput.trim() !== '') {
        const existente = fornecedores.find((f) => f.nome.toLowerCase().trim() === fornecedorInput.toLowerCase().trim());
        if (existente) {
          idDoFornecedor = existente.id;
        } else {
          const { data: novoForn, error: erroForn } = await supabase
            .from('fornecedores')
            .insert({ nome: fornecedorInput.trim() })
            .select('id')
            .single();
          if (erroForn) throw new Error('Erro ao criar novo fornecedor: ' + erroForn.message);
          idDoFornecedor = novoForn.id;
        }
      }

      // 3. A compra (o banco soma ao estoque e recalcula o custo médio)
      const { error: erroCompra } = await supabase.from('compras').insert({
        unidade_id: unidade,
        ingrediente_id: idDoIngrediente,
        fornecedor_id: idDoFornecedor,
        quantidade: q,
        preco_unitario: p,
      });
      if (erroCompra) {
        throw new Error(erroCompra.message.includes('row-level security')
          ? 'Você não tem permissão para lançar compras nesta unidade.'
          : 'Erro ao salvar compra: ' + erroCompra.message);
      }

      avisar(`Compra de ${ingredienteInput.trim()} registrada.`);
      setQuantidade('');
      setPrecoUnitario('');
      setIngredienteInput('');
      setFornecedorInput('');
      router.refresh();
    } catch (err: any) {
      avisar(err.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      <div className="field">
        <label htmlFor="cf-unidade">Unidade</label>
        <select id="cf-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} required>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cf-insumo">Insumo</label>
        <input
          id="cf-insumo" list="lista-ingredientes" value={ingredienteInput}
          onChange={(e) => setIngredienteInput(e.target.value)}
          placeholder="Escolha da lista ou digite um novo" autoComplete="off" required
        />
        <datalist id="lista-ingredientes">
          {ingredientes.map((i) => <option key={i.id} value={i.nome} />)}
        </datalist>
        {ingredienteNovo && <p className="dica" style={{ color: 'var(--gold)' }}>Insumo novo — será cadastrado junto com a compra.</p>}
      </div>

      {/* Insumo novo: escolhe a medida (não dá para mudar depois pela tela) */}
      {ingredienteNovo && (
        <div className="field">
          <label htmlFor="cf-medida">Medida do novo insumo</label>
          <select id="cf-medida" value={medidaNova} onChange={(e) => setMedidaNova(e.target.value)}>
            {['UN', 'KG', 'G', 'L', 'ML'].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="cf-fornecedor">Fornecedor <span style={{ color: 'var(--mut2)', fontWeight: 500 }}>(opcional)</span></label>
        <input
          id="cf-fornecedor" list="lista-fornecedores" value={fornecedorInput}
          onChange={(e) => setFornecedorInput(e.target.value)} placeholder="Escolha ou digite um novo" autoComplete="off"
        />
        <datalist id="lista-fornecedores">
          {fornecedores.map((f) => <option key={f.id} value={f.nome} />)}
        </datalist>
      </div>

      <div className="field2">
        <div className="field">
          <label htmlFor="cf-qtd">Quantidade</label>
          <div className="inp-un">
            <input id="cf-qtd" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" required />
            <span>{siglaMedida}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="cf-preco">Preço por {siglaMedida}</label>
          <div className="inp-un">
            <input id="cf-preco" inputMode="decimal" value={precoUnitario} onChange={(e) => setPrecoUnitario(e.target.value)} placeholder="0,00" required />
            <span>R$</span>
          </div>
        </div>
      </div>

      <div className="total-linha">
        <span>Total da compra</span>
        <b>{totalPrevisto > 0 ? brl(totalPrevisto) : '—'}</b>
      </div>

      <button type="submit" className="btn prim" disabled={carregando}>
        {carregando ? 'Registrando…' : 'Registrar compra'}
      </button>
    </form>
  );
}
