import TopBar from '@/components/TopBar';
import CompraForm from '@/components/CompraForm';
import { IcoNota } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Compras({ searchParams }: { searchParams: { u?: string } }) {
  const supabase = createClient();
  const [{ data: unidades }, { data: ingredientes }, { data: fornecedores }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('ingredientes').select('*').eq('ativo', true).order('nome'),
    supabase.from('fornecedores').select('*').order('nome'),
  ]);

  const alvo = (unidades || []).find((x) => x.codigo === searchParams.u);

  let rq = supabase
    .from('compras')
    .select('*, ingredientes(nome, unidade_medida), unidades(nome, codigo, cor), fornecedores(nome)')
    .order('criado_em', { ascending: false })
    .limit(12);
  if (alvo) rq = rq.eq('unidade_id', alvo.id);
  const { data: recentes } = await rq;

  const total = (recentes || []).reduce((s: number, c: any) => s + Number(c.total), 0);

  return (
    <>
      <TopBar titulo={alvo ? `Compras — ${alvo.nome}` : 'Registrar compra'} unidades={unidades || []} />

      <div className="wrap">
        <div className="grid2">
          <section>
            <div className="lbl">Nova compra</div>
            <div className="panel sticky">
              <div className="panel-body">
                <CompraForm
                  unidades={unidades || []}
                  ingredientes={ingredientes || []}
                  fornecedores={fornecedores || []}
                  unidadeInicial={alvo?.id}
                />
              </div>
            </div>
          </section>

          <section>
            <div className="lbl">Últimas compras</div>
            <div className="panel">
              <div className="sh">
                <div className="si"><IcoNota size={20} /></div>
                <div>
                  <div className="sv">{brl(total)}</div>
                  <div className="sl">{(recentes || []).length} últimos lançamentos</div>
                </div>
              </div>

              {(recentes || []).map((c: any) => (
                <div className="al" key={c.id}>
                  <span className="adot" style={{ background: c.unidades?.cor || 'var(--gold)' }} />
                  <div className="ab">
                    <b>{c.ingredientes?.nome}</b>
                    <span>
                      {num(c.quantidade, 2)} {c.ingredientes?.unidade_medida} · {c.fornecedores?.nome || 'sem fornecedor'}
                    </span>
                  </div>
                  <div className="ar">
                    <div className="aq">{brl(c.total)}</div>
                    <div className="au">{alvo ? c.data_compra?.split('-').reverse().join('/') : c.unidades?.nome}</div>
                  </div>
                </div>
              ))}
              {(!recentes || recentes.length === 0) && <div className="vazio">Nenhuma compra registrada.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
