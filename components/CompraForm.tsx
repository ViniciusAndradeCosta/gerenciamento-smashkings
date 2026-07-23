'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };

export default function CompraForm({ unidades, ingredientes, fornecedores }: {
  unidades: Opt[]; ingredientes: Opt[]; fornecedores: Opt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [unidade, setUnidade] = useState(unidades[0]?.id || '');
  const [ingrediente, setIngrediente] = useState(ingredientes[0]?.id || '');
  const [fornecedor, setFornecedor] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setMsg(''); setSalvando(true);
    const { error } = await supabase.from('compras').insert({
      unidade_id: unidade,
      ingrediente_id: ingrediente,
      fornecedor_id: fornecedor || null,
      quantidade: Number(quantidade),
      preco_unitario: Number(preco),
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setMsg('✓ Compra registrada! Estoque e CMP atualizados.');
    setQuantidade(''); setPreco('');
    router.refresh();
  }

  return (
    <div className="card"><div className="cb" style={{ paddingTop: 12 }}>
      {msg && <div className="err" style={{ background: 'var(--gdim)', borderColor: 'rgba(45,211,111,.3)', color: 'var(--green)' }}>{msg}</div>}
      {erro && <div className="err">{erro}</div>}
      <form onSubmit={salvar}>
        <div className="field"><label>Unidade</label>
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            {unidades.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
        <div className="field"><label>Ingrediente</label>
          <select value={ingrediente} onChange={(e) => setIngrediente(e.target.value)}>
            {ingredientes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
        <div className="field"><label>Fornecedor</label>
          <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
            <option value="">— opcional —</option>
            {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
        <div className="field2">
          <div className="field"><label>Quantidade</label>
            <input type="number" step="any" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="ex: 10" required />
          </div>
          <div className="field"><label>Preço unit. (R$)</label>
            <input type="number" step="any" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="ex: 5.45" required />
          </div>
        </div>
        <button className="btn prim" disabled={salvando}>{salvando ? 'Salvando…' : '✓ Registrar compra'}</button>
      </form>
    </div></div>
  );
}
