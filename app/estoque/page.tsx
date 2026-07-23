import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Estoque({ searchParams }: { searchParams: { u?: string } }) {
  const u = searchParams.u || 'all';
  const supabase = createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = unidades?.find((x) => x.codigo === u);

  let q = supabase
    .from('estoque')
    .select('*, ingredientes(nome, unidade_medida), unidades(nome, codigo, cor)')
    .order('quantidade', { ascending: true });
  if (alvo) q = q.eq('unidade_id', alvo.id);
  const { data: itens } = await q;

  const st = (it: any) => {
    if (it.quantidade <= 0) return { cor: '#e63946', tag: 'r', txt: 'Sem estoque' };
    if (it.quantidade < it.estoque_minimo) return { cor: '#e63946', tag: 'r', txt: 'Crítico' };
    if (it.quantidade < it.estoque_minimo * 1.3) return { cor: '#f4a261', tag: 'o', txt: 'Baixo' };
    return { cor: '#2dd36f', tag: 'g', txt: 'OK' };
  };

  return (
    <>
      <Header sub={alvo ? alvo.nome : 'Estoque consolidado'} />
      <div className="wrap">
        <div className="sec-t">{alvo ? `Estoque — ${alvo.nome}` : 'Estoque de todas as unidades'}</div>
        <div className="card"><div className="cb" style={{ paddingTop: 6 }}><div className="slist">
          {(itens || []).map((it: any) => {
            const s = st(it);
            return (
              <div className="srow" key={it.id}>
                <div className="sinfo">
                  <div className="sn">{it.ingredientes?.nome}{!alvo && <span className="tag b" style={{ marginLeft: 6 }}>{it.unidades?.codigo}</span>}</div>
                  <div className="smeta">CMP {brl(it.custo_medio)} · mín {num(it.estoque_minimo, 2)} {it.ingredientes?.unidade_medida}</div>
                </div>
                <div className="sright">
                  <div className="sqty" style={{ color: s.cor }}>{num(it.quantidade, 2)} {it.ingredientes?.unidade_medida}</div>
                  <div style={{ marginTop: 4 }}><span className={'tag ' + s.tag}>{s.txt}</span></div>
                </div>
              </div>
            );
          })}
          {(!itens || itens.length === 0) && <div style={{ padding: 14, color: 'var(--t2)', fontSize: 13 }}>Nenhum item cadastrado ainda.</div>}
        </div></div></div>
      </div>
    </>
  );
}
