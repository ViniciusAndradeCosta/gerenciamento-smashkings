import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Comparativo() {
  const supabase = createClient();
  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const inicioMes = new Date(); inicioMes.setDate(1);
  const desde = inicioMes.toISOString().slice(0, 10);

  const { data: custos } = await supabase.from('v_custo_produto').select('*');
  const custoMap = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));
  const { data: valorEst } = await supabase.from('v_valor_estoque').select('*');

  const dados = await Promise.all((unidades || []).map(async (un) => {
    const { data: v } = await supabase.from('vendas').select('produto_id, quantidade, valor_total').eq('unidade_id', un.id).gte('data_venda', desde);
    const fat = (v || []).reduce((s, x) => s + Number(x.valor_total), 0);
    const custo = (v || []).reduce((s, x) => s + (custoMap.get(x.produto_id) || 0) * Number(x.quantidade), 0);
    const est = (valorEst || []).find((e: any) => e.unidade_id === un.id)?.valor_total || 0;
    return { un, fat, cmv: fat ? (custo / fat) * 100 : 0, estoque: Number(est) };
  }));

  return (
    <>
      <Header sub="Comparativo" />
      <div className="wrap">
        <div className="sec-t">Centro vs Norte — este mês</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dados.map(({ un, fat, cmv, estoque }) => (
            <div className="card" key={un.id} style={{ margin: 0 }}>
              <div className="ch" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: un.cor }} />
                  <div className="ct">{un.nome}</div>
                </div>
                <span className="tag b" style={{ background: 'rgba(79,195,247,.12)', color: un.cor }}>{un.codigo}</span>
              </div>
              <div className="cb" style={{ paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}><span style={{ color: 'var(--t2)' }}>💰 Faturamento (mês)</span><strong>{brl(fat)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}><span style={{ color: 'var(--t2)' }}>📊 CMV</span><strong style={{ color: cmv <= 35 ? 'var(--green)' : 'var(--red)' }}>{pct(cmv)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}><span style={{ color: 'var(--t2)' }}>📦 Valor em estoque</span><strong>{brl(estoque)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
