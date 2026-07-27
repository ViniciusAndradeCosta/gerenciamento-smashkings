import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Fichas() {
  const supabase = createClient();
  const { data: produtos } = await supabase.from('v_custo_produto').select('*').order('nome');

  return (
    <>
      {/* fichas técnicas são do cardápio, não de uma unidade — sem filtro de unidade */}
      <TopBar titulo="Fichas técnicas" />

      <div className="wrap">
        <div className="lbl">Cardápio — custo e margem</div>

        <div className="panel">
          <div className="tscroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Produto</th><th>Custo</th><th>Venda</th><th>CMV</th><th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {(produtos || []).map((p: any) => {
                  const cmv = Number(p.cmv_percent);
                  const margem = Number(p.margem_percent);
                  const semFicha = Number(p.custo_ingredientes) === 0;
                  return (
                    <tr key={p.produto_id}>
                      <td>
                        {p.nome}
                        {semFicha && <span className="tag r" style={{ marginLeft: 8 }}>sem ficha</span>}
                      </td>
                      <td className="num">{brl(p.custo_total)}</td>
                      <td className="num">{brl(p.preco_venda)}</td>
                      <td><span className={'tag ' + (cmv <= 35 ? 'g' : cmv <= 45 ? 'o' : 'r')}>{pct(cmv)}</span></td>
                      <td className="num" style={{ color: margem >= 65 ? 'var(--grn)' : 'var(--gold)' }}>{pct(margem)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(!produtos || produtos.length === 0) && <div className="vazio">Nenhum produto cadastrado.</div>}
        </div>

        <div className="lbl">Atenção</div>
        <div className="panel">
          <div className="panel-body nota">
            Produto marcado como <strong>sem ficha</strong> não tem ingredientes cadastrados: o custo mostrado é
            só o custo extra, então o CMV aparece baixo demais e a margem alta demais. Cadastre a ficha técnica
            para o número ficar real.
          </div>
        </div>
      </div>
    </>
  );
}
