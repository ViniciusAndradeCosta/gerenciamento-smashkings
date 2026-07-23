import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: { u?: string } }) {
  const u = searchParams.u || 'all';
  const supabase = createClient();

  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = unidades?.find((x) => x.codigo === u);
  const hoje = new Date().toISOString().slice(0, 10);

  // Vendas de hoje
  let vq = supabase.from('vendas').select('valor_total, quantidade, unidade_id').eq('data_venda', hoje);
  if (alvo) vq = vq.eq('unidade_id', alvo.id);
  const { data: vendas } = await vq;
  const faturamento = (vendas || []).reduce((s, x) => s + Number(x.valor_total), 0);
  const pedidos = (vendas || []).reduce((s, x) => s + Number(x.quantidade), 0);
  const ticket = pedidos ? faturamento / pedidos : 0;

  // Valor em estoque
  let veq = supabase.from('v_valor_estoque').select('*');
  if (alvo) veq = veq.eq('unidade_id', alvo.id);
  const { data: valorEst } = await veq;
  const valorEstoque = (valorEst || []).reduce((s, x) => s + Number(x.valor_total), 0);

  // Alertas
  let aq = supabase.from('v_alertas_estoque').select('*').neq('status', 'ok');
  if (alvo) aq = aq.eq('unidade_id', alvo.id);
  const { data: alertas } = await aq;

  // Split por unidade (só no consolidado)
  const porUnidade = !alvo
    ? (unidades || []).map((un) => {
        const fv = (vendas || []).filter((v) => v.unidade_id === un.id).reduce((s, x) => s + Number(x.valor_total), 0);
        return { ...un, fat: fv };
      })
    : [];
  const totalFat = porUnidade.reduce((s, x) => s + x.fat, 0) || 1;

  const statusCor: Record<string, string> = { critico: '#e63946', sem_estoque: '#e63946', baixo: '#f4a261' };

  return (
    <>
      <Header sub={alvo ? alvo.nome : 'Todas as unidades'} />
      <div className="wrap">
        <div className="sec-t">Resumo de hoje</div>
        <div className="kg">
          <div className="kpi r"><div className="kl">💰 Faturamento</div><div className="kv">{brl(faturamento)}</div><div className="kd">Hoje</div></div>
          <div className="kpi b"><div className="kl">🏷️ Ticket médio</div><div className="kv">{brl(ticket)}</div><div className="kd">{pedidos} itens</div></div>
          <div className="kpi o"><div className="kl">📦 Em estoque</div><div className="kv">{brl(valorEstoque)}</div><div className="kd warn">{alertas?.length || 0} alertas</div></div>
          <div className="kpi g"><div className="kl">🛒 Pedidos hoje</div><div className="kv">{pedidos}</div><div className="kd ok">—</div></div>
        </div>

        {!alvo && porUnidade.length > 0 && (
          <>
            <div className="sec-t">Por unidade — hoje</div>
            <div className="usplit">
              {porUnidade.map((un) => (
                <div className="ubox" key={un.id}>
                  <div className="l"><span className="d" style={{ background: un.cor }} />{un.nome}</div>
                  <div className="v">{brl(un.fat)}</div>
                  <div className="s" style={{ color: un.cor }}>{Math.round((un.fat / totalFat) * 100)}% do total</div>
                  <div className="sbar" style={{ width: '100%', marginTop: 8 }}><div style={{ width: `${(un.fat / totalFat) * 100}%`, background: un.cor }} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sec-t">Alertas de estoque</div>
        <div className="card"><div className="cb" style={{ paddingTop: 6 }}>
          {(alertas && alertas.length > 0) ? alertas.map((a: any, i: number) => (
            <div className="al" key={i}>
              <div className="al-d" style={{ background: statusCor[a.status] || '#f4a261' }} />
              <div className="al-b">
                <strong>{a.ingrediente}</strong>
                <span>{a.quantidade} {a.unidade_medida} · mín {a.estoque_minimo}</span>
              </div>
              <div className="al-u" style={{ background: 'rgba(230,57,70,.14)', color: '#e63946' }}>{a.unidade_codigo}</div>
            </div>
          )) : <div style={{ padding: 14, color: 'var(--t2)', fontSize: 13 }}>Tudo em ordem ✓</div>}
        </div></div>

        <div className="sec-t">Comparar unidades</div>
        <a href="/comparativo?u=all" className="card" style={{ display: 'block' }}>
          <div className="cb" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
            <div style={{ fontSize: 26 }}>⚖️</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>Análise comparativa</div><div style={{ fontSize: 11.5, color: 'var(--t2)' }}>Centro vs Norte lado a lado</div></div>
            <div style={{ color: 'var(--red)', fontSize: 18 }}>→</div>
          </div>
        </a>
      </div>
    </>
  );
}
