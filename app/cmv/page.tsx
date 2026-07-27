import TopBar from '@/components/TopBar';
import { IcoCmv, IcoCompras, IcoDinheiro, IcoNota } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, brlCurto, pct } from '@/lib/format';
import { inicioDoMes } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function CMV({ searchParams }: { searchParams: { u?: string } }) {
  const supabase = createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = (unidades || []).find((x) => x.codigo === searchParams.u);
  const desde = inicioDoMes();

  const { data: custos } = await supabase.from('v_custo_produto').select('produto_id, custo_total');
  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));

  let vq = supabase.from('vendas').select('produto_id, quantidade, valor_total').gte('data_venda', desde);
  if (alvo) vq = vq.eq('unidade_id', alvo.id);
  let cq = supabase.from('compras').select('total').gte('data_compra', desde);
  if (alvo) cq = cq.eq('unidade_id', alvo.id);
  const [{ data: vendas }, { data: compras }] = await Promise.all([vq, cq]);

  const faturamento = (vendas || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);
  const custoVendido = (vendas || []).reduce((s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade), 0);
  const cmvPct = faturamento ? (custoVendido / faturamento) * 100 : 0;
  const totalCompras = (compras || []).reduce((s: number, x: any) => s + Number(x.total), 0);
  const naMeta = cmvPct > 0 && cmvPct <= 35;

  return (
    <>
      <TopBar titulo={alvo ? `CMV — ${alvo.nome}` : 'CMV consolidado'} unidades={unidades || []} />

      <div className="wrap">
        <div className="lbl">CMV do mês</div>
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

        <div className="lbl">Como o CMV é calculado</div>
        <div className="panel">
          <div className="panel-body nota">
            O <strong>CMV%</strong> é o custo dos produtos efetivamente vendidos dividido pelo faturamento do
            período. Cada venda usa o custo da ficha técnica — a soma do CMP (custo médio ponderado) de cada
            ingrediente. Meta saudável para hamburgueria: <strong className="g">28% a 35%</strong>.
            <br /><br />
            No mês, {brl(faturamento)} vendidos custaram {brl(custoVendido)} em insumos.
          </div>
        </div>
      </div>
    </>
  );
}
