import TopBar from '@/components/TopBar';
import { IcoEstoque } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Estoque({ searchParams }: { searchParams: { u?: string } }) {
  const supabase = createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = (unidades || []).find((x) => x.codigo === searchParams.u);

  let q = supabase.from('estoque').select('*, ingredientes(nome, unidade_medida), unidades(nome, codigo, cor)');
  if (alvo) q = q.eq('unidade_id', alvo.id);
  const { data: itens } = await q;

  const st = (it: any) => {
    const qtd = Number(it.quantidade);
    const min = Number(it.estoque_minimo);
    if (qtd <= 0) return { cor: 'var(--red)', tag: 'r', txt: 'Sem estoque', ordem: 0 };
    if (qtd < min) return { cor: 'var(--red)', tag: 'r', txt: 'Crítico', ordem: 1 };
    if (qtd < min * 1.3) return { cor: 'var(--gold)', tag: 'o', txt: 'Baixo', ordem: 2 };
    return { cor: 'var(--grn)', tag: 'g', txt: 'OK', ordem: 3 };
  };

  // Ordena por criticidade (razão qtd/mínimo), não pela quantidade crua —
  // 7 kg de batata e 20 pães não são comparáveis como números.
  const lista = [...(itens || [])].sort((a: any, b: any) => {
    const sa = st(a), sb = st(b);
    if (sa.ordem !== sb.ordem) return sa.ordem - sb.ordem;
    const ra = Number(a.estoque_minimo) > 0 ? Number(a.quantidade) / Number(a.estoque_minimo) : Infinity;
    const rb = Number(b.estoque_minimo) > 0 ? Number(b.quantidade) / Number(b.estoque_minimo) : Infinity;
    return ra - rb;
  });

  const valor = lista.reduce((s: number, it: any) => s + Number(it.quantidade) * Number(it.custo_medio), 0);
  const emAlerta = lista.filter((it: any) => st(it).ordem < 3).length;

  return (
    <>
      <TopBar titulo={alvo ? alvo.nome : 'Estoque consolidado'} unidades={unidades || []} />

      <div className="wrap">
        <div className="lbl">{alvo ? `Estoque — ${alvo.nome}` : 'Estoque de todas as unidades'}</div>

        <div className="panel">
          <div className="sh">
            <div className="si"><IcoEstoque size={20} /></div>
            <div>
              <div className="sv">{brl(valor)}</div>
              <div className="sl">{lista.length} {lista.length === 1 ? 'item' : 'itens'} em estoque</div>
            </div>
            <span className={'sbtag' + (emAlerta ? '' : ' ok')}>
              {emAlerta ? `${emAlerta} ${emAlerta === 1 ? 'alerta' : 'alertas'}` : 'tudo ok'}
            </span>
          </div>

          <div className="cards">
            {lista.map((it: any) => {
              const s = st(it);
              const un = it.ingredientes?.unidade_medida;
              return (
                <div className="al" key={it.id}>
                  <span className="adot" style={{ background: s.cor }} />
                  <div className="ab">
                    <b>{it.ingredientes?.nome}</b>
                    <span>CMP {brl(it.custo_medio)} · mín {num(it.estoque_minimo, 2)} {un}</span>
                  </div>
                  <div className="ar">
                    <div className="aq" style={{ color: s.cor }}>{num(it.quantidade, 2)} {un}</div>
                    <div className="au">{alvo ? s.txt : `${s.txt} · ${it.unidades?.nome}`}</div>
                  </div>
                </div>
              );
            })}
            {lista.length === 0 && <div className="vazio">Nenhum item cadastrado ainda.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
