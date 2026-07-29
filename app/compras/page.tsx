import TopBar from '@/components/TopBar';
import CompraForm from '@/components/CompraForm';
import ImportarNotaForm from '@/components/ImportarNotaForm'; 
import { IcoNota } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, num } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Compras({ searchParams }: { searchParams: { u?: string; modo?: string } }) {
  const supabase = createClient();
  const [{ data: unidades }, { data: ingredientes }, { data: fornecedores }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('ingredientes').select('*').eq('ativo', true).order('nome'),
    supabase.from('fornecedores').select('*').order('nome'),
  ]);

  const alvo = (unidades || []).find((x) => x.codigo === searchParams.u);
  
  // Verifica qual aba está ativa (manual ou ocr)
  const modoAtual = searchParams.modo || 'manual';

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
      <TopBar titulo={alvo ? `Compras — ${alvo.nome}` : 'Registrar compra'}/>

      <div className="wrap">
        {/* Container Flexbox à prova de falhas: Quebra a linha no celular automaticamente */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* SEÇÃO DA ESQUERDA (FORMULÁRIO): Forçamos ela a ser a maior (flex 60%) */}
          <section style={{ flex: '1 1 60%', minWidth: '320px' }}>
            
            {/* ABAS DE NAVEGAÇÃO */}
            <div className="useg" style={{ marginBottom: 15, justifyContent: 'flex-start', padding: 0 }}>
              <Link href={alvo ? `?u=${alvo.codigo}&modo=manual` : `?modo=manual`}>
                <button className={modoAtual === 'manual' ? 'act' : ''}>Mão</button>
              </Link>
              <Link href={alvo ? `?u=${alvo.codigo}&modo=ocr` : `?modo=ocr`}>
                <button className={modoAtual === 'ocr' ? 'act' : ''}>Nota Fiscal (IA)</button>
              </Link>
            </div>

            <div className="panel sticky">
              <div className="panel-body">
                {modoAtual === 'manual' ? (
                  <CompraForm
                    unidades={unidades || []}
                    ingredientes={ingredientes || []}
                    fornecedores={fornecedores || []}
                    unidadeInicial={alvo?.id}
                  />
                ) : (
                  <ImportarNotaForm 
                    unidades={unidades || []}
                    ingredientes={ingredientes || []}
                  />
                )}
              </div>
            </div>
          </section>

          {/* SEÇÃO DA DIREITA (LISTA): Forçamos ela a ser a menor (flex 30%) */}
          <section style={{ flex: '1 1 30%', minWidth: '320px' }}>
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