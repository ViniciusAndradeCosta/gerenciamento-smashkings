import { Suspense } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import UnitSwitcher from '@/components/UnitSwitcher';
import CompraForm from '@/components/CompraForm';
import ImportarNotaForm from '@/components/ImportarNotaForm';
import { IcoAjuste, IcoNota } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Quantidade sem zeros sobrando: 14, 0,42, 1,5 */
const qtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v || 0);

export default async function Compras({ searchParams }: { searchParams: Promise<{ u?: string; modo?: string }> }) {
  const { u, modo } = await searchParams;
  const supabase = await createClient();
  const [{ data: unidades }, { data: ingredientes }, { data: fornecedores }] = await Promise.all([
    supabase.from('unidades').select('*').order('codigo'),
    supabase.from('ingredientes').select('*').order('nome'),
    supabase.from('fornecedores').select('*').order('nome'),
  ]);

  const alvo = (unidades || []).find((x) => x.codigo === u);
  const modoAtual = modo === 'ocr' ? 'ocr' : 'manual';
  const link = (m: string) => (alvo ? `?u=${alvo.codigo}&modo=${m}` : `?modo=${m}`);

  let rq = supabase
    .from('compras')
    .select('*, ingredientes(nome, unidade_medida), unidades(nome, codigo, cor), fornecedores(nome)')
    .order('criado_em', { ascending: false })
    .limit(15);
  if (alvo) rq = rq.eq('unidade_id', alvo.id);
  const { data: recentes } = await rq;

  const total = (recentes || []).reduce((s: number, c: any) => s + Number(c.total), 0);

  return (
    <>
      <PageHeader titulo="Compras" subtitulo="Cada compra soma ao estoque e atualiza o custo médio">
        <Suspense fallback={<div className="useg" />}>
          <UnitSwitcher unidades={unidades || []} />
        </Suspense>
      </PageHeader>

      <div className="pg">
        <div className="duas-col">
          <section>
            <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
              <Link href={link('manual')} role="tab" aria-selected={modoAtual === 'manual'} className={modoAtual === 'manual' ? 'act' : ''}>
                <IcoAjuste size={16} /> Manual
              </Link>
              <Link href={link('ocr')} role="tab" aria-selected={modoAtual === 'ocr'} className={modoAtual === 'ocr' ? 'act' : ''}>
                <IcoNota size={16} /> Nota fiscal (IA)
              </Link>
            </div>

            <div className="panel">
              <div className="panel-body">
                {modoAtual === 'manual' ? (
                  <CompraForm
                    unidades={unidades || []}
                    ingredientes={ingredientes || []}
                    fornecedores={fornecedores || []}
                    unidadeInicial={alvo?.id}
                  />
                ) : (
                  <ImportarNotaForm unidades={unidades || []} ingredientes={ingredientes || []} unidadeInicial={alvo?.id} />
                )}
              </div>
            </div>
          </section>

          <section>
            <div className="lbl">Últimas compras</div>
            <div className="lista">
              <div className="lista-cab">
                <span>{(recentes || []).length} lançamentos{alvo ? ` · ${alvo.nome}` : ''}</span>
                <b style={{ color: 'var(--txt)' }}>{brl(total)}</b>
              </div>
              {(recentes || []).map((c: any) => (
                <div className="item" key={c.id}>
                  <span className="item-ic" style={{ background: 'transparent', border: '1px solid var(--line)' }}>
                    <span className="ud-inline" style={{ background: c.unidades?.cor || 'var(--gold)', margin: 0, width: 10, height: 10 }} />
                  </span>
                  <div className="item-main">
                    <div className="item-tit">{c.ingredientes?.nome || '—'}</div>
                    <div className="item-sub">
                      {qtd(Number(c.quantidade))} {c.ingredientes?.unidade_medida} · {c.fornecedores?.nome || 'sem fornecedor'}
                      {c.origem === 'nota_fiscal' && <> · <span style={{ color: 'var(--gold)' }}>nota fiscal</span></>}
                    </div>
                  </div>
                  <div className="item-dir">
                    <div className="item-val" style={{ fontSize: 17 }}>{brl(Number(c.total))}</div>
                    <div className="item-mini">
                      {c.unidades?.nome || '—'} · {c.data_compra ? c.data_compra.split('-').reverse().slice(0, 2).join('/') : ''}
                    </div>
                  </div>
                </div>
              ))}
              {(!recentes || recentes.length === 0) && <div className="vazio">Nenhuma compra registrada ainda.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
