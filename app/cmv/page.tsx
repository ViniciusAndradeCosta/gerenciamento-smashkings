import { Suspense } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import UnitSwitcher from '@/components/UnitSwitcher';
import { IcoCmv, IcoCompras, IcoDinheiro, IcoNota } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, brlCurto, num, pct } from '@/lib/format';
import { inicioDoMes } from '@/lib/date';

export const dynamic = 'force-dynamic';

const corCmv = (cmv: number) => (cmv <= 0 ? 'n' : cmv <= 35 ? 'g' : cmv <= 45 ? 'o' : 'r');

export default async function CMV({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const supabase = await createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const lojas = (unidades || []).filter((un) => !un.e_producao && un.codigo !== 'geral');
  const alvo = lojas.find((x) => x.codigo === u);
  const desde = inicioDoMes();

  let vq = supabase.from('vendas').select('produto_id, quantidade, valor_total').gte('data_venda', desde);
  if (alvo) vq = vq.eq('unidade_id', alvo.id);
  let cq = supabase.from('compras').select('total').gte('data_compra', desde);
  if (alvo) cq = cq.eq('unidade_id', alvo.id);
  const [{ data: custos }, { data: vendas }, { data: compras }] = await Promise.all([
    supabase.from('v_custo_produto').select('produto_id, nome, preco_venda, custo_ingredientes, custo_total, cmv_percent'),
    vq,
    cq,
  ]);

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));
  const faturamento = (vendas || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);
  const custoVendido = (vendas || []).reduce((s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade), 0);
  const cmvPct = faturamento ? (custoVendido / faturamento) * 100 : 0;
  const totalCompras = (compras || []).reduce((s: number, x: any) => s + Number(x.total), 0);
  const naMeta = cmvPct > 0 && cmvPct <= 35;

  // produtos com o CMV de ficha mais alto: onde vale revisar preço ou receita
  // (sem ficha montada o custo é só o fixo e o CMV sairia enganosamente baixo)
  const ranking = (custos || [])
    .filter((c: any) => Number(c.preco_venda) > 0 && Number(c.custo_ingredientes) > 0)
    .sort((a: any, b: any) => Number(b.cmv_percent) - Number(a.cmv_percent))
    .slice(0, 8);

  return (
    <>
      <PageHeader titulo="CMV" subtitulo={alvo ? `Custo da mercadoria vendida · ${alvo.nome}` : 'Custo da mercadoria vendida · consolidado'}>
        <Suspense fallback={<div className="useg" />}>
          <UnitSwitcher unidades={lojas} />
        </Suspense>
      </PageHeader>

      <div className="pg">
        <div className="lbl">Este mês</div>
        <div className="krow k4">
          <div className="kc">
            <div className="ki"><IcoCmv size={19} /></div>
            <div className={'kv ' + (naMeta ? 'grn' : cmvPct > 35 ? 'red' : '')}>{pct(cmvPct)}</div>
            <div className="kl">CMV do período</div>
            <div className={'kf ' + (naMeta ? 'ok' : 'warn')}>{naMeta ? 'Dentro da meta' : cmvPct > 35 ? 'Acima da meta' : 'Sem vendas'}</div>
          </div>
          <div className="kc">
            <div className="ki"><IcoCompras size={19} /></div>
            <div className="kv">{brlCurto(custoVendido)}</div>
            <div className="kl">Custo do que foi vendido</div>
          </div>
          <div className="kc">
            <div className="ki"><IcoDinheiro size={19} /></div>
            <div className="kv">{brlCurto(faturamento)}</div>
            <div className="kl">Faturamento no mês</div>
          </div>
          <div className="kc">
            <div className="ki"><IcoNota size={19} /></div>
            <div className="kv">{brlCurto(totalCompras)}</div>
            <div className="kl">Compras no mês</div>
          </div>
        </div>

        <div className="duas-col">
          <section>
            <div className="lbl">
              Produtos com maior CMV
              <Link href="/fichas">Ver fichas</Link>
            </div>
            <div className="lista">
              {ranking.length === 0 && <div className="vazio">Cadastre produtos com preço e ficha técnica para ver o ranking.</div>}
              {ranking.map((c: any) => (
                <div className="item" key={c.produto_id}>
                  <div className="item-main">
                    <div className="item-tit">{c.nome}</div>
                    <div className="item-sub">Venda {brl(Number(c.preco_venda))} · custo {brl(Number(c.custo_total))}</div>
                  </div>
                  <div className="item-dir">
                    <span className={'tag ' + corCmv(Number(c.cmv_percent))}>{num(Number(c.cmv_percent), 1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="lbl">Como o CMV é calculado</div>
            <div className="panel">
              <div className="panel-body nota">
                O <strong>CMV%</strong> é o custo dos produtos efetivamente vendidos dividido pelo faturamento do
                período. Cada venda usa o custo da ficha técnica — o custo médio (CMP) de cada insumo, o custo dos
                preparos e o custo fixo. Meta saudável para hamburgueria: <strong className="g">28% a 35%</strong>.
                <br /><br />
                No mês, {brl(faturamento)} vendidos custaram {brl(custoVendido)} em insumos.
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
