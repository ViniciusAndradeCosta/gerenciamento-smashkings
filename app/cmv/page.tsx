import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CMV({ searchParams }: { searchParams: { u?: string } }) {
  const u = searchParams.u || 'all';
  const supabase = createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = unidades?.find((x) => x.codigo === u);

  const inicioMes = new Date();
  inicioMes.setDate(1);
  const desde = inicioMes.toISOString().slice(0, 10);

  // Custo por produto (view)
  const { data: custos } = await supabase.from('v_custo_produto').select('*');
  const custoMap = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));

  // Vendas do mês
  let vq = supabase.from('vendas').select('produto_id, quantidade, valor_total, unidade_id').gte('data_venda', desde);
  if (alvo) vq = vq.eq('unidade_id', alvo.id);
  const { data: vendas } = await vq;

  const faturamento = (vendas || []).reduce((s, x) => s + Number(x.valor_total), 0);
  const custoVendido = (vendas || []).reduce((s, x) => s + (custoMap.get(x.produto_id) || 0) * Number(x.quantidade), 0);
  const cmvPct = faturamento ? (custoVendido / faturamento) * 100 : 0;

  // Compras do mês
  let cq = supabase.from('compras').select('total, unidade_id').gte('data_compra', desde);
  if (alvo) cq = cq.eq('unidade_id', alvo.id);
  const { data: compras } = await cq;
  const totalCompras = (compras || []).reduce((s, x) => s + Number(x.total), 0);

  const meta = cmvPct <= 35;

  return (
    <>
      <Header sub={alvo ? alvo.nome : 'CMV consolidado'} />
      <div className="wrap">
        <div className="sec-t">CMV do mês</div>
        <div className="kg">
          <div className="kpi g"><div className="kl">📊 CMV %</div><div className="kv" style={{ color: meta ? 'var(--green)' : 'var(--red)' }}>{pct(cmvPct)}</div><div className={'kd ' + (meta ? 'ok' : 'warn')}>{meta ? '✓ Meta ≤35%' : '⚠ Acima da meta'}</div></div>
          <div className="kpi r"><div className="kl">🥩 Custo vendido</div><div className="kv">{brl(custoVendido)}</div><div className="kd">Produtos</div></div>
          <div className="kpi b"><div className="kl">💰 Faturamento</div><div className="kv" style={{ fontSize: 19 }}>{brl(faturamento)}</div><div className="kd">No mês</div></div>
          <div className="kpi o"><div className="kl">🧾 Compras</div><div className="kv" style={{ fontSize: 19 }}>{brl(totalCompras)}</div><div className="kd">No mês</div></div>
        </div>

        <div className="sec-t">Como o CMV é calculado</div>
        <div className="card"><div className="cb" style={{ paddingTop: 12, fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
          O <strong style={{ color: 'var(--text)' }}>CMV%</strong> é o custo dos produtos efetivamente vendidos dividido pelo faturamento do período. Cada venda usa o custo da ficha técnica (soma do CMP de cada ingrediente). Meta saudável para hamburgueria: <strong style={{ color: 'var(--green)' }}>28% a 35%</strong>.
        </div></div>
      </div>
    </>
  );
}
