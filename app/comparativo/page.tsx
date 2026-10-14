import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';
import { inicioDoMes } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function Comparativo() {
  const supabase = await createClient();
  const desde = inicioDoMes();

  const [{ data: unidades }, { data: custos }, { data: valorEst }, { data: vendas }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('v_custo_produto').select('produto_id, custo_total'),
    supabase.from('v_valor_estoque').select('*'),
    supabase.from('vendas').select('unidade_id, produto_id, quantidade, valor_total').gte('data_venda', desde),
  ]);

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));

  // FILTRO: Removemos a unidade 'Geral' da lista para que ela não apareça no comparativo
  const lojasFisicas = (unidades || []).filter((u: any) => u.codigo !== 'geral');

  // Usamos a lista filtrada (lojasFisicas) para fazer os cálculos
  const dados = lojasFisicas.map((un) => {
    const minhas = (vendas || []).filter((v: any) => v.unidade_id === un.id);
    const fat = minhas.reduce((s: number, x: any) => s + Number(x.valor_total), 0);
    const custo = minhas.reduce((s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade), 0);
    const estoque = Number((valorEst || []).find((e: any) => e.unidade_id === un.id)?.valor_total || 0);
    return { un, fat, cmv: fat ? (custo / fat) * 100 : 0, estoque };
  });

  const totalFat = dados.reduce((s, d) => s + d.fat, 0);

  return (
    <>
      <TopBar titulo="Comparativo entre unidades" />

      <div className="wrap">
        <div className="lbl">Este mês, lado a lado</div>

        <div className="usplit">
          {dados.map(({ un, fat, cmv, estoque }) => {
            const share = totalFat ? (fat / totalFat) * 100 : 0;
            return (
              <div className="ub" key={un.id}>
                <div className="l"><span className="d" style={{ background: un.cor }} />{un.nome}</div>
                <div className="v">{brl(fat)}</div>
                <div className="bar"><div style={{ width: `${share}%`, background: un.cor }} /></div>
                <div className="pct" style={{ color: un.cor }}>{pct(share)} do faturamento</div>

                <div className="rows">
                  <div>CMV <b style={{ color: cmv > 0 && cmv <= 35 ? 'var(--grn)' : cmv > 35 ? 'var(--red)' : undefined }}>{pct(cmv)}</b></div>
                  <div>Valor em estoque <b>{brl(estoque)}</b></div>
                </div>
              </div>
            );
          })}
        </div>

        {dados.length === 0 && <div className="panel"><div className="vazio">Nenhuma unidade cadastrada.</div></div>}

        <div className="lbl">Leitura</div>
        <div className="panel">
          <div className="panel-body nota">
            O CMV de cada unidade usa hoje o <strong>mesmo custo de ficha técnica</strong> para as duas — a view
            de custo não separa o CMP por unidade. Enquanto isso não for ajustado, a comparação de faturamento e
            de estoque é confiável; a de CMV serve como referência, não como número fechado.
          </div>
        </div>
      </div>
    </>
  );
}
