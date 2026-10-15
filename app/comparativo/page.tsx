import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';
import { inicioDoMes } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function Comparativo() {
  const supabase = await createClient();
  const desde = inicioDoMes();

  const [{ data: unidades }, { data: custos }, { data: valorEst }, { data: vendas }, { data: alertas }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('v_custo_produto').select('produto_id, custo_total'),
    supabase.from('v_valor_estoque').select('*'),
    supabase.from('vendas').select('unidade_id, produto_id, quantidade, valor_total').gte('data_venda', desde),
    supabase.from('v_alertas_estoque').select('unidade_id').neq('status', 'ok'),
  ]);

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));

  // A produção (cozinha central) não entra no comparativo de lojas
  const lojas = (unidades || []).filter((u: any) => !u.e_producao && u.codigo !== 'geral');

  const dados = lojas.map((un) => {
    const minhas = (vendas || []).filter((v: any) => v.unidade_id === un.id);
    const fat = minhas.reduce((s: number, x: any) => s + Number(x.valor_total), 0);
    const itens = minhas.reduce((s: number, x: any) => s + Number(x.quantidade), 0);
    const custo = minhas.reduce((s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade), 0);
    const estoque = Number((valorEst || []).find((e: any) => e.unidade_id === un.id)?.valor_total || 0);
    const emAlerta = (alertas || []).filter((a: any) => a.unidade_id === un.id).length;
    return { un, fat, itens, cmv: fat ? (custo / fat) * 100 : 0, estoque, emAlerta };
  });

  const totalFat = dados.reduce((s, d) => s + d.fat, 0);

  return (
    <>
      <PageHeader titulo="Comparativo" subtitulo="As unidades lado a lado neste mês" />

      <div className="pg">
        <div className="usplit">
          {dados.map(({ un, fat, itens, cmv, estoque, emAlerta }) => {
            const share = totalFat ? (fat / totalFat) * 100 : 0;
            return (
              <div className="ub" key={un.id}>
                <div className="l"><span className="d" style={{ background: un.cor }} />{un.nome}</div>
                <div className="v">{brl(fat)}</div>
                <div className="bar"><div style={{ width: `${share}%`, background: un.cor }} /></div>
                <div className="pct" style={{ color: un.cor }}>{pct(share)} do faturamento</div>

                <div className="rows">
                  <div>Itens vendidos <b>{itens}</b></div>
                  <div>CMV <b style={{ color: cmv > 0 && cmv <= 35 ? 'var(--grn)' : cmv > 35 ? 'var(--red)' : undefined }}>{pct(cmv)}</b></div>
                  <div>Valor em estoque <b>{brl(estoque)}</b></div>
                  <div>Itens em alerta <b style={{ color: emAlerta ? 'var(--gold)' : 'var(--grn)' }}>{emAlerta}</b></div>
                </div>
              </div>
            );
          })}
        </div>

        {dados.length === 0 && <div className="panel"><div className="vazio">Nenhuma unidade cadastrada.</div></div>}

        <div className="lbl">Leitura</div>
        <div className="panel">
          <div className="panel-body nota">
            O CMV de cada unidade usa o <strong>mesmo custo de ficha técnica</strong> para as duas — o custo médio
            dos insumos é calculado para a rede inteira. A comparação de faturamento e de estoque é exata; a de CMV
            serve como referência.
          </div>
        </div>
      </div>
    </>
  );
}
