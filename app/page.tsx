import Link from 'next/link';
import { Suspense } from 'react';
import Hero from '@/components/Hero';
import PageHeader from '@/components/PageHeader';
import UnitSwitcher from '@/components/UnitSwitcher';
import { IcoCompras, IcoPedidos, IcoCmv, IcoEstoque, IcoNota, IcoProducao } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, brlCurto, num, pct } from '@/lib/format';
import { hoje, ontem, inicioDoMes, saudacao } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const supabase = await createClient();

  // Conta criada mas ainda não liberada por um admin: o RLS não deixa ver
  // nada, então em vez de um painel zerado mostramos o aviso.
  // perfil e unidades em paralelo: uma ida ao banco a menos por abertura
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: perfil }, { data: unidades }] = await Promise.all([
    user ? supabase.from('perfis').select('papel').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('unidades').select('*').order('codigo'),
  ]);
  if (perfil?.papel !== 'admin' && perfil?.papel !== 'gerente') {
    return (
      <>
        <PageHeader titulo="Acesso pendente" subtitulo="Conta aguardando liberação" />
        <div className="pg">
          <div className="panel">
            <div className="panel-body nota">
              Sua conta <strong>{user?.email}</strong> foi criada, mas ainda não tem acesso aos dados.
              <br /><br />
              Peça para o administrador liberar seu acesso (papel <strong>gerente</strong> ou{' '}
              <strong>admin</strong> na tabela <code>perfis</code> do Supabase) e entre de novo.
            </div>
          </div>
        </div>
      </>
    );
  }

  // A produção (cozinha central) tem tela própria e não entra como loja
  // ('geral' cobre bancos que ainda não rodaram o schema novo)
  const lojas = (unidades || []).filter((un) => !un.e_producao && un.codigo !== 'geral');
  const idsLojas = new Set(lojas.map((un) => un.id));
  const alvo = lojas.find((x) => x.codigo === u);

  const hj = hoje();
  const ont = ontem();
  const desde = inicioDoMes();
  const porUnidadeDe = (q: any) => (alvo ? q.eq('unidade_id', alvo.id) : q);

  const [
    { data: vHoje },
    { data: vOntem },
    { data: vMes },
    { data: custos },
    { data: valorEstTodos },
    { data: alertasTodos },
  ] = await Promise.all([
    porUnidadeDe(supabase.from('vendas').select('valor_total, quantidade, unidade_id').eq('data_venda', hj)),
    porUnidadeDe(supabase.from('vendas').select('valor_total').eq('data_venda', ont)),
    porUnidadeDe(supabase.from('vendas').select('produto_id, quantidade, valor_total').gte('data_venda', desde)),
    supabase.from('v_custo_produto').select('produto_id, custo_total'),
    porUnidadeDe(supabase.from('v_valor_estoque').select('*')),
    porUnidadeDe(supabase.from('v_alertas_estoque').select('*').neq('status', 'ok')),
  ]);

  const faturamento = (vHoje || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);
  const itens = (vHoje || []).reduce((s: number, x: any) => s + Number(x.quantidade), 0);
  const fatOntem = (vOntem || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);
  const porItem = itens ? faturamento / itens : 0;

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));
  const fatMes = (vMes || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);
  const custoMes = (vMes || []).reduce((s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade), 0);
  const cmv = fatMes ? (custoMes / fatMes) * 100 : 0;

  // estoque e alertas só das lojas (o da produção aparece na tela Produção)
  const valorEst = (valorEstTodos || []).filter((x: any) => idsLojas.has(x.unidade_id));
  const alertas = (alertasTodos || []).filter((x: any) => idsLojas.has(x.unidade_id));
  const valorEstoque = valorEst.reduce((s: number, x: any) => s + Number(x.valor_total), 0);

  const porUnidade = alvo
    ? []
    : lojas
        .map((un) => ({
          ...un,
          fat: (vHoje || []).filter((v: any) => v.unidade_id === un.id).reduce((s: number, x: any) => s + Number(x.valor_total), 0),
        }));
        
  const totalFat = porUnidade.reduce((s, x) => s + x.fat, 0);

  const primeiroNome = String(user?.user_metadata?.nome || user?.email || '').split(/[\s@]/)[0];
  
  const qtdUnidades = lojas.length;
  
  const linkEstoque = alvo ? `/estoque?u=${alvo.codigo}` : '/estoque';

  return (
    <>
      <Hero
        saudacao={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''} · ${alvo ? alvo.nome : `${qtdUnidades} unidades`}`}
        faturamento={faturamento}
        ontem={fatOntem}
        itens={itens}
      />

      <Suspense fallback={<div className="useg" />}>
        <UnitSwitcher unidades={lojas} />
      </Suspense>

      <div className="wrap">
        <div className="lbl">Atalhos</div>
        <nav className="atalhos" aria-label="Atalhos">
          <Link href="/compras" className="atalho"><span><IcoCompras size={21} /></span>Nova compra</Link>
          <Link href="/compras?modo=ocr" className="atalho"><span><IcoNota size={21} /></span>Ler nota</Link>
          <Link href={linkEstoque} className="atalho"><span><IcoEstoque size={21} /></span>Estoque</Link>
          <Link href="/producao" className="atalho"><span><IcoProducao size={21} /></span>Produção</Link>
        </nav>

        <div className="lbl">Resumo do dia</div>
        <div className="krow">
          <div className="kc">
            <div className="ki"><IcoCompras size={19} /></div>
            <div className="kv">{brlCurto(porItem)}</div>
            <div className="kl">Valor médio por item</div>
          </div>
          <div className="kc">
            <div className="ki"><IcoPedidos size={19} /></div>
            <div className="kv">{num(itens)}</div>
            <div className="kl">Itens vendidos hoje</div>
          </div>
          <div className="kc">
            <div className="ki"><IcoCmv size={19} /></div>
            <div className={'kv ' + (cmv > 0 && cmv <= 35 ? 'grn' : cmv > 35 ? 'red' : '')}>{pct(cmv)}</div>
            <div className="kl">CMV do mês</div>
          </div>
        </div>

        <div className={porUnidade.length > 0 ? 'dash' : ''}>
          <section>
            <div className="lbl">
              Estoque
              <Link href={linkEstoque}>Ver tudo</Link>
            </div>
            <div className="panel">
              <div className="sh">
                <div className="si"><IcoEstoque size={20} /></div>
                <div>
                  <div className="sv">{brl(valorEstoque)}</div>
                  <div className="sl">Valor total em estoque</div>
                </div>
                <span className={'sbtag' + (alertas?.length ? '' : ' ok')}>
                  {alertas?.length ? `${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'}` : 'tudo ok'}
                </span>
              </div>

              {(alertas || []).length > 0 ? (
                (alertas || []).slice(0, 6).map((a: any, i: number) => (
                  <div className="al" key={i}>
                    <span className="adot" style={{ background: a.status === 'baixo' ? 'var(--gold)' : 'var(--red)' }} />
                    <div className="ab">
                      <b>{a.ingrediente}</b>
                      <span>mín {num(a.estoque_minimo, 2)} {a.unidade_medida}</span>
                    </div>
                    <div className="ar">
                      <div className="aq" style={{ color: a.status === 'baixo' ? 'var(--gold)' : 'var(--red)' }}>
                        {num(a.quantidade, 2)} {a.unidade_medida}
                      </div>
                      {!alvo && <div className="au">{a.unidade_nome}</div>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="vazio">Nenhum item abaixo do mínimo ✓</div>
              )}
            </div>
          </section>

          {porUnidade.length > 0 && (
            <section>
              <div className="lbl">Por unidade — hoje</div>
              <div className="usplit">
                {porUnidade.map((un) => {
                  const share = totalFat ? (un.fat / totalFat) * 100 : 0;
                  return (
                    <div className="ub" key={un.id}>
                      <div className="l"><span className="d" style={{ background: un.cor }} />{un.nome}</div>
                      <div className="v">{brl(un.fat)}</div>
                      <div className="bar"><div style={{ width: `${share}%`, background: un.cor }} /></div>
                      <div className="pct" style={{ color: un.cor }}>{pct(share)} do total</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}