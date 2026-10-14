import Link from 'next/link';
import { Suspense } from 'react';
import Hero from '@/components/Hero';
import TopBar from '@/components/TopBar';
import UnitSwitcher from '@/components/UnitSwitcher';
import { IcoCompras, IcoPedidos, IcoCmv, IcoEstoque } from '@/components/Icons';
import { createClient } from '@/lib/supabase/server';
import { brl, brlCurto, num, pct } from '@/lib/format';
import { hoje, ontem, inicioDoMes, saudacao } from '@/lib/date';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const supabase = await createClient();

  // Conta criada mas ainda não liberada por um admin: o RLS não deixa ver
  // nada, então em vez de um painel zerado mostramos o aviso.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await supabase.from('perfis').select('papel').eq('id', user.id).maybeSingle()
    : { data: null };
  if (perfil?.papel !== 'admin' && perfil?.papel !== 'gerente') {
    return (
      <>
        <TopBar titulo="Acesso pendente" />
        <div className="wrap">
          <div className="lbl">Conta aguardando liberação</div>
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

  const { data: unidades } = await supabase.from('unidades').select('*').order('codigo');
  const alvo = (unidades || []).find((x) => x.codigo === u);

  const hj = hoje();
  const ont = ontem();
  const desde = inicioDoMes();
  const porUnidadeDe = (q: any) => (alvo ? q.eq('unidade_id', alvo.id) : q);

  const [
    { data: vHoje },
    { data: vOntem },
    { data: vMes },
    { data: custos },
    { data: valorEst },
    { data: alertas },
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

  const valorEstoque = (valorEst || []).reduce((s: number, x: any) => s + Number(x.valor_total), 0);

  // FILTRO: Removemos o 'geral' para montar os cards de faturamento por unidade
  const porUnidade = alvo
    ? []
    : (unidades || [])
        .filter((un) => un.codigo !== 'geral')
        .map((un) => ({
          ...un,
          fat: (vHoje || []).filter((v: any) => v.unidade_id === un.id).reduce((s: number, x: any) => s + Number(x.valor_total), 0),
        }));
        
  const totalFat = porUnidade.reduce((s, x) => s + x.fat, 0);

  const primeiroNome = String(user?.user_metadata?.nome || user?.email || '').split(/[\s@]/)[0];
  
  // FILTRO: Contamos apenas as lojas reais (ignorando o 'geral') para o título
  const qtdUnidades = (unidades || []).filter((u) => u.codigo !== 'geral').length;
  
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
        {/* O UnitSwitcher continua recebendo todas as unidades (incluindo o Geral) para os botões funcionarem */}
        <UnitSwitcher unidades={unidades || []} />
      </Suspense>

      <div className="wrap">
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