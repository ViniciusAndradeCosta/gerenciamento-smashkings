import Header from '@/components/Header';
import { createClient } from '@/lib/supabase/server';
import { brl, pct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Fichas() {
  const supabase = createClient();
  const { data: produtos } = await supabase.from('v_custo_produto').select('*').order('nome');

  return (
    <>
      <Header sub="Fichas técnicas" />
      <div className="wrap">
        <div className="sec-t">Cardápio — custo e margem</div>
        <div className="card"><div className="cb tscroll" style={{ paddingTop: 8 }}>
          <table className="tbl">
            <thead><tr><th>Produto</th><th>Custo</th><th>Venda</th><th>CMV</th><th>Margem</th></tr></thead>
            <tbody>
              {(produtos || []).map((p: any) => (
                <tr key={p.produto_id}>
                  <td>{p.nome}</td>
                  <td>{brl(p.custo_total)}</td>
                  <td>{brl(p.preco_venda)}</td>
                  <td><span className="tag g">{pct(p.cmv_percent)}</span></td>
                  <td style={{ color: p.margem_percent >= 65 ? 'var(--green)' : 'var(--gold)', fontWeight: 700 }}>{pct(p.margem_percent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!produtos || produtos.length === 0) && <div style={{ padding: 14, color: 'var(--t2)', fontSize: 13 }}>Nenhum produto cadastrado.</div>}
        </div></div>
      </div>
    </>
  );
}
