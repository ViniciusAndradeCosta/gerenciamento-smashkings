import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, num } from '@/lib/format';
import CompraForm from '@/components/CompraForm';

export const dynamic = 'force-dynamic';

export default async function Compras() {
  const supabase = createClient();
  const [{ data: unidades }, { data: ingredientes }, { data: fornecedores }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('ingredientes').select('*').eq('ativo', true).order('nome'),
    supabase.from('fornecedores').select('*').order('nome'),
  ]);

  const { data: recentes } = await supabase
    .from('compras')
    .select('*, ingredientes(nome, unidade_medida), unidades(codigo, cor), fornecedores(nome)')
    .order('criado_em', { ascending: false })
    .limit(10);

  return (
    <>
      <Header sub="Registrar compra" />
      <div className="wrap">
        <div className="sec-t">Nova compra</div>
        <CompraForm
          unidades={unidades || []}
          ingredientes={ingredientes || []}
          fornecedores={fornecedores || []}
        />

        <div className="sec-t">Últimas compras</div>
        <div className="card"><div className="cb" style={{ paddingTop: 6 }}><div className="slist">
          {(recentes || []).map((c: any) => (
            <div className="srow" key={c.id}>
              <div className="sinfo">
                <div className="sn">{c.ingredientes?.nome} <span className="tag b" style={{ marginLeft: 4 }}>{c.unidades?.codigo}</span></div>
                <div className="smeta">{num(c.quantidade, 2)} {c.ingredientes?.unidade_medida} · {c.fornecedores?.nome || 'sem fornecedor'}</div>
              </div>
              <div className="sright"><div className="sqty">{brl(c.total)}</div></div>
            </div>
          ))}
          {(!recentes || recentes.length === 0) && <div style={{ padding: 14, color: 'var(--t2)', fontSize: 13 }}>Nenhuma compra registrada.</div>}
        </div></div></div>
      </div>
    </>
  );
}
