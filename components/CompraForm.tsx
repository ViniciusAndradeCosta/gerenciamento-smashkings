'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { IcoMais } from './Icons';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };

export default function CompraForm({
  unidades, ingredientes, fornecedores, unidadeInicial,
}: {
  unidades: Opt[]; ingredientes: Opt[]; fornecedores: Opt[]; unidadeInicial?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [unidade, setUnidade] = useState(unidadeInicial || unidades[0]?.id || '');
  const [ingrediente, setIngrediente] = useState(ingredientes[0]?.id || '');
  const [fornecedor, setFornecedor] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const q = Number(quantidade);
  const p = Number(preco);
  const total = Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
  const medida = ingredientes.find((i) => i.id === ingrediente)?.unidade_medida;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setMsg('');

    if (!Number.isFinite(q) || q <= 0) return setErro('Informe uma quantidade maior que zero.');
    if (!Number.isFinite(p) || p < 0) return setErro('O preço unitário não pode ser negativo.');

    setSalvando(true);
    const { error } = await supabase.from('compras').insert({
      unidade_id: unidade,
      ingrediente_id: ingrediente,
      fornecedor_id: fornecedor || null,
      quantidade: q,
      preco_unitario: p,
    });
    setSalvando(false);

    if (error) {
      setErro(
        error.code === '42501'
          ? 'Você não tem permissão para lançar compras nessa unidade.'
          : error.message
      );
      return;
    }
    setMsg('Compra registrada — estoque e CMP atualizados.');
    setQuantidade(''); setPreco('');
    router.refresh();
  }

  return (
    <>
      {msg && <div className="msg ok">{msg}</div>}
      {erro && <div className="msg err">{erro}</div>}

      <form onSubmit={salvar}>
        <div className="field">
          <label htmlFor="cf-un">Unidade</label>
          <select id="cf-un" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {unidades.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="cf-ing">Ingrediente</label>
          <select id="cf-ing" value={ingrediente} onChange={(e) => setIngrediente(e.target.value)}>
            {ingredientes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="cf-forn">Fornecedor</label>
          <select id="cf-forn" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
            <option value="">— opcional —</option>
            {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        <div className="field2">
          <div className="field">
            <label htmlFor="cf-qtd">Quantidade{medida ? ` (${medida})` : ''}</label>
            <input
              id="cf-qtd" type="number" step="any" min="0" inputMode="decimal"
              value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="10" required
            />
          </div>
          <div className="field">
            <label htmlFor="cf-preco">Preço unit. (R$)</label>
            <input
              id="cf-preco" type="number" step="any" min="0" inputMode="decimal"
              value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="5,45" required
            />
          </div>
        </div>

        {total > 0 && (
          <div className="lbl" style={{ margin: '4px 2px 14px' }}>
            Total da nota
            <span style={{ fontFamily: 'var(--cond)', fontSize: 24, color: 'var(--gold)' }}>{brl(total)}</span>
          </div>
        )}

        <button className="btn prim" disabled={salvando}>
          <IcoMais size={17} />
          {salvando ? 'Salvando…' : 'Registrar compra'}
        </button>
      </form>
    </>
  );
}
