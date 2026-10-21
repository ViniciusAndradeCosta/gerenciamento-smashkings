'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import QtdInput from '@/components/QtdInput';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoProducao, IcoTransferir, IcoSeta, IcoEstoque, IcoMais } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { campoQtd, custoPor, fmtQtd, lerCampo, normalizar, preferida, qtdPartes, type CampoQtd } from '@/lib/medidas';

type Unidade = { id: string; nome: string; codigo: string; cor?: string; e_producao?: boolean };
type Ingrediente = { id: string; nome: string; unidade_medida: string; custo_medio: number; e_produzido_internamente?: boolean; rendimento_receita?: number };
type Estoque = { unidade_id: string; ingrediente_id: string; quantidade: number };
type ItemPreparo = { insumo_pai_id: string; ingrediente_id: string; quantidade: number };
type Producao = { id: string; ingrediente_id: string; quantidade: number; baixou_insumos: boolean; criado_em: string };
type Transferencia = { id: string; ingrediente_id: string; origem_id: string; destino_id: string; quantidade: number; criado_em: string };

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export default function ProducaoPage() {
  const supabase = createClient();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [receitas, setReceitas] = useState<ItemPreparo[]>([]);
  const [producoes, setProducoes] = useState<Producao[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [faltaMigracao, setFaltaMigracao] = useState(false);
  const [aba, setAba] = useState<'estoque' | 'historico'>('estoque');
  const [busca, setBusca] = useState('');

  // janela do item: transferir para loja ou corrigir a contagem
  const [item, setItem] = useState<Ingrediente | null>(null);
  const [modo, setModo] = useState<'transferir' | 'ajustar'>('transferir');
  const [destino, setDestino] = useState('');
  const [qtdTransf, setQtdTransf] = useState<CampoQtd>({ texto: '', medida: 'un' });
  const [contagem, setContagem] = useState<CampoQtd>({ texto: '', medida: 'un' });

  // janela de produção
  const [produzindo, setProduzindo] = useState(false);
  const [preparoId, setPreparoId] = useState('');
  const [qtdProduzida, setQtdProduzida] = useState<CampoQtd>({ texto: '', medida: 'un' });
  const [baixarInsumos, setBaixarInsumos] = useState(true);

  const [salvando, setSalvando] = useState(false);

  async function carregarDados() {
    const [resUni, resIng, resEst, resCusto, resRec, resProd, resTransf] = await Promise.all([
      supabase.from('unidades').select('*').order('nome'),
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('estoque').select('unidade_id, ingrediente_id, quantidade'),
      supabase.from('v_custo_ingrediente').select('ingrediente_id, custo_unitario'),
      supabase.from('preparo_itens').select('insumo_pai_id, ingrediente_id, quantidade'),
      supabase.from('producoes').select('*').order('criado_em', { ascending: false }).limit(40),
      supabase.from('transferencias').select('*').order('criado_em', { ascending: false }).limit(40),
    ]);
    // sem as tabelas novas o schema.sql atualizado ainda não rodou no Supabase
    setFaltaMigracao(!!resProd.error || !(resUni.data || []).some((u) => u.e_producao));

    const custoDe = new Map((resCusto.data || []).map((c) => [c.ingrediente_id, Number(c.custo_unitario)]));
    setUnidades(resUni.data || []);
    setIngredientes((resIng.data || []).map((i) => ({ ...i, custo_medio: custoDe.get(i.id) ?? i.custo_medio })));
    setEstoques(resEst.data || []);
    setReceitas(resRec.data || []);
    setProducoes(resProd.data || []);
    setTransferencias(resTransf.data || []);
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  const producao = unidades.find((u) => u.e_producao);
  const lojas = unidades.filter((u) => !u.e_producao);
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome || '—';
  const ingDe = (id: string) => ingredientes.find((i) => i.id === id);
  const qtdEm = (uniId: string | undefined, ingId: string) =>
    Number(estoques.find((e) => e.unidade_id === uniId && e.ingrediente_id === ingId)?.quantidade || 0);
  const naProducao = (ingId: string) => qtdEm(producao?.id, ingId);

  const preparos = ingredientes.filter((i) => i.e_produzido_internamente);

  // o que mostrar: todos os preparos e os insumos que têm saldo na produção
  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const comSaldo = new Set(estoques.filter((e) => e.unidade_id === producao?.id && Number(e.quantidade) !== 0).map((e) => e.ingrediente_id));
    return ingredientes
      .filter((i) => i.e_produzido_internamente || comSaldo.has(i.id))
      .filter((i) => !termo || i.nome.toLowerCase().includes(termo))
      .sort((a, b) => Number(!!b.e_produzido_internamente) - Number(!!a.e_produzido_internamente) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [ingredientes, estoques, producao, busca]);

  const valorTotal = ingredientes.reduce((s, i) => s + Math.max(naProducao(i.id), 0) * Number(i.custo_medio || 0), 0);
  const preparosProntos = preparos.filter((p) => naProducao(p.id) > 0).length;

  const historico = useMemo(() => [
    ...producoes.map((p) => ({ tipo: 'producao' as const, id: p.id, quando: p.criado_em, p })),
    ...transferencias.map((t) => ({ tipo: 'transferencia' as const, id: t.id, quando: t.criado_em, t })),
  ].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 40), [producoes, transferencias]);

  // ---------- transferir / ajustar ----------
  function abrirItem(i: Ingrediente) {
    setItem(i);
    setModo('transferir');
    setDestino(lojas[0]?.id || '');
    setQtdTransf({ texto: '', medida: preferida(naProducao(i.id), i.unidade_medida) });
    setContagem(campoQtd(naProducao(i.id), i.unidade_medida));
  }

  async function transferir() {
    if (!item) return;
    const q = lerCampo(qtdTransf, item.unidade_medida);
    if (!destino) return avisar('Escolha a loja de destino.', 'erro');
    if (!(q > 0)) return avisar('Informe a quantidade a transferir.', 'erro');
    if (q > naProducao(item.id) + 1e-9) return avisar(`A produção só tem ${fmtQtd(naProducao(item.id), item.unidade_medida)}.`, 'erro');

    setSalvando(true);
    const { error } = await supabase.rpc('transferir_estoque', { p_ingrediente: item.id, p_destino: destino, p_quantidade: q });
    setSalvando(false);
    if (error) return avisar(error.message, 'erro');
    avisar(`${fmtQtd(q, item.unidade_medida)} de ${item.nome} enviados para ${nomeUnidade(destino)}.`);
    setItem(null);
    carregarDados();
  }

  async function ajustar() {
    if (!item || !producao) return;
    const novo = lerCampo(contagem, item.unidade_medida);
    if (isNaN(novo) || novo < 0) return avisar('Informe uma quantidade válida.', 'erro');
    const diferenca = novo - naProducao(item.id);
    if (Math.abs(diferenca) < 1e-9) return setItem(null);

    setSalvando(true);
    const { error } = await supabase.rpc('somar_estoque', { p_unidade: producao.id, p_ingrediente: item.id, p_qtd: diferenca, p_custo: 0 });
    setSalvando(false);
    if (error) return avisar('Erro ao ajustar: ' + error.message, 'erro');
    avisar(`Contagem de ${item.nome} atualizada.`);
    setItem(null);
    carregarDados();
  }

  // ---------- produzir ----------
  function abrirProducao(prep?: Ingrediente) {
    setPreparoId(prep?.id || preparos[0]?.id || '');
    setQtdProduzida((q) => ({ ...q, texto: '' }));
    setBaixarInsumos(true);
    setItem(null);
    setProduzindo(true);
  }

  const preparo = ingDe(preparoId);
  // trocou o preparo: o campo volta para a medida dele
  const basePreparo = preparo?.unidade_medida;
  useEffect(() => { setQtdProduzida((q) => ({ ...q, medida: normalizar(basePreparo) })); }, [basePreparo]);
  const receita = receitas.filter((r) => r.insumo_pai_id === preparoId);
  const qProd = lerCampo(qtdProduzida, basePreparo);
  const rendimento = Number(preparo?.rendimento_receita || 1) || 1;
  const consumo = receita.map((r) => {
    const ing = ingDe(r.ingrediente_id);
    const precisa = qProd > 0 ? (Number(r.quantidade) * qProd) / rendimento : 0;
    return { ing, precisa, tem: naProducao(r.ingrediente_id) };
  });
  const falta = baixarInsumos && consumo.some((c) => c.precisa > c.tem);

  async function produzir() {
    if (!preparo) return avisar('Escolha o preparo.', 'erro');
    if (!(qProd > 0)) return avisar('Informe quanto foi produzido.', 'erro');
    setSalvando(true);
    const { error } = await supabase.rpc('registrar_producao', { p_preparo: preparo.id, p_quantidade: qProd, p_baixar_insumos: baixarInsumos && receita.length > 0 });
    setSalvando(false);
    if (error) return avisar(error.message, 'erro');
    avisar(`Produção registrada: ${fmtQtd(qProd, preparo.unidade_medida)} de ${preparo.nome}.`);
    setProduzindo(false);
    carregarDados();
  }

  const saldoItem = item ? naProducao(item.id) : 0;
  const qT = item ? lerCampo(qtdTransf, item.unidade_medida) : NaN;
  const fq = (v: number) => fmtQtd(v, item?.unidade_medida);

  return (
    <>
      <PageHeader
        titulo="Produção"
        subtitulo="Cozinha central: preparos e envio para as lojas"
        acoes={
          <button className="bt bt-prim bt-ic-mob" onClick={() => abrirProducao()} disabled={!preparos.length || faltaMigracao} aria-label="Registrar produção">
            <IcoMais size={17} /><span>Registrar produção</span>
          </button>
        }
      />

      <div className="pg">
        {faltaMigracao && !carregando && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-body nota">
              Para usar a Produção, rode o <strong>supabase/schema.sql</strong> atualizado no SQL Editor do Supabase.
              Ele cria o histórico e as operações de produzir e transferir, sem apagar nenhum dado.
            </div>
          </div>
        )}

        <div className="resumo">
          <div><span>Valor na produção</span><b>{brl(valorTotal)}</b></div>
          <div><span>Preparos prontos</span><b className={preparosProntos ? 'g' : ''}>{preparosProntos}</b></div>
          <div><span>Envios recentes</span><b>{transferencias.length}</b></div>
        </div>

        <div className="filtros">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={aba === 'estoque'} className={aba === 'estoque' ? 'act' : ''} onClick={() => setAba('estoque')}>
              <IcoEstoque size={16} /> Estoque
            </button>
            <button role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'act' : ''} onClick={() => setAba('historico')}>
              <IcoTransferir size={16} /> Histórico
            </button>
          </div>
          {aba === 'estoque' && (
            <label className="busca">
              <IcoBusca size={17} />
              <input className="inp" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na produção…" aria-label="Buscar na produção" />
            </label>
          )}
        </div>

        {aba === 'estoque' ? (
          <div className="lista">
            {!carregando && linhas.length > 0 && <div className="lista-cab"><span>Toque num item para enviar a uma loja</span></div>}
            {carregando ? (
              <div className="vazio">Carregando a produção…</div>
            ) : linhas.length === 0 ? (
              <div className="vazio">
                {busca ? `Nada encontrado para "${busca}".` : 'Nada na produção ainda. Cadastre os preparos (American Cheese, molhos…) na tela Preparos e registre o que foi produzido.'}
              </div>
            ) : (
              linhas.map((i) => {
                const saldo = naProducao(i.id);
                const partes = qtdPartes(saldo, i.unidade_medida);
                return (
                  <button key={i.id} className="item" onClick={() => abrirItem(i)}>
                    <span className="item-ic">{i.e_produzido_internamente ? <IcoProducao size={19} /> : <IcoEstoque size={19} />}</span>
                    <div className="item-main">
                      <div className="item-tit">
                        {i.nome}
                        {saldo <= 0 && <span className="tag r">Sem estoque</span>}
                      </div>
                      <div className="item-sub">
                        {i.e_produzido_internamente ? 'Preparo' : 'Insumo'} · {custoPor(Number(i.custo_medio || 0), i.unidade_medida)}
                      </div>
                    </div>
                    <div className="item-dir">
                      <div className="item-val" style={{ color: saldo <= 0 ? 'var(--red)' : undefined }}>{partes.numero}<small>{partes.medida}</small></div>
                      <div className="item-mini">{brl(Math.max(saldo, 0) * Number(i.custo_medio || 0))}</div>
                    </div>
                    <IcoSeta size={16} className="item-chev" />
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="lista">
            {historico.length === 0 && <div className="vazio">Nenhuma produção ou envio registrado ainda.</div>}
            {historico.map((h) => {
              if (h.tipo === 'producao') {
                const ing = ingDe(h.p.ingrediente_id);
                return (
                  <div className="item" key={'p' + h.id}>
                    <span className="item-ic"><IcoProducao size={19} /></span>
                    <div className="item-main">
                      <div className="item-tit">Produziu {fmtQtd(Number(h.p.quantidade), ing?.unidade_medida)} de {ing?.nome || '—'}</div>
                      <div className="item-sub">{dataHora(h.quando)}{h.p.baixou_insumos ? ' · insumos baixados' : ''}</div>
                    </div>
                  </div>
                );
              }
              const ing = ingDe(h.t.ingrediente_id);
              return (
                <div className="item" key={'t' + h.id}>
                  <span className="item-ic" style={{ background: 'var(--ndim)', color: 'var(--grn)' }}><IcoTransferir size={19} /></span>
                  <div className="item-main">
                    <div className="item-tit">{fmtQtd(Number(h.t.quantidade), ing?.unidade_medida)} de {ing?.nome || '—'}</div>
                    <div className="item-sub">{nomeUnidade(h.t.origem_id)} → {nomeUnidade(h.t.destino_id)} · {dataHora(h.quando)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- item: enviar para loja / corrigir contagem ---------- */}
      <Sheet
        aberto={!!item}
        titulo={item?.nome || ''}
        subtitulo={item ? `Na produção: ${fq(saldoItem)}` : ''}
        onFechar={() => setItem(null)}
        rodape={
          modo === 'transferir' ? (
            <>
              <button className="bt bt-sec" onClick={() => setItem(null)}>Cancelar</button>
              <button className="bt bt-prim" onClick={transferir} disabled={salvando || saldoItem <= 0 || faltaMigracao}>
                <IcoTransferir size={17} /> {salvando ? 'Enviando…' : 'Enviar'}
              </button>
            </>
          ) : (
            <>
              <button className="bt bt-sec" onClick={() => setItem(null)}>Cancelar</button>
              <button className="bt bt-prim" onClick={ajustar} disabled={salvando || faltaMigracao}>{salvando ? 'Salvando…' : 'Salvar contagem'}</button>
            </>
          )
        }
      >
        {item && (
          <>
            <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
              <button role="tab" aria-selected={modo === 'transferir'} className={modo === 'transferir' ? 'act' : ''} onClick={() => setModo('transferir')}>
                <IcoTransferir size={16} /> Enviar para loja
              </button>
              <button role="tab" aria-selected={modo === 'ajustar'} className={modo === 'ajustar' ? 'act' : ''} onClick={() => setModo('ajustar')}>
                <IcoEstoque size={16} /> Corrigir contagem
              </button>
            </div>

            {modo === 'transferir' ? (
              saldoItem <= 0 ? (
                <div className="vazio" style={{ padding: '12px 0 4px' }}>
                  Não há {item.nome} na produção para enviar.
                  {item.e_produzido_internamente && (
                    <><br /><button className="bt bt-sec" style={{ marginTop: 12 }} onClick={() => abrirProducao(item)}><IcoProducao size={16} /> Registrar produção</button></>
                  )}
                </div>
              ) : (
                <>
                  <div className="sheet-sec">Para qual loja</div>
                  <div className="chips" style={{ margin: '0 0 16px', padding: 0, flexWrap: 'wrap' }}>
                    {lojas.map((u) => (
                      <button key={u.id} className={'chip' + (destino === u.id ? ' act' : '')} onClick={() => setDestino(u.id)}>
                        <span className="ud" style={{ background: u.cor || 'var(--gold)' }} />
                        {u.nome}
                      </button>
                    ))}
                  </div>

                  <div className="field">
                    <label htmlFor="qtd-transf">Quantidade</label>
                    <div className="add-linha">
                      <div className="field" style={{ flex: 1 }}>
                        <QtdInput id="qtd-transf" base={item.unidade_medida} texto={qtdTransf.texto} medida={qtdTransf.medida}
                          placeholder={`até ${qtdPartes(saldoItem, item.unidade_medida).numero}`}
                          onChange={(texto, medida) => setQtdTransf({ texto, medida })} />
                      </div>
                      <button type="button" className="bt bt-sec" style={{ height: 48 }} onClick={() => setQtdTransf(campoQtd(saldoItem, item.unidade_medida))}>Tudo</button>
                    </div>
                  </div>

                  {qT > 0 && destino && (
                    <div className={'previa' + (qT > saldoItem + 1e-9 ? ' erro' : '')}>
                      {qT > saldoItem + 1e-9 ? (
                        <>A produção só tem {fq(saldoItem)}.</>
                      ) : (
                        <>
                          <div><span>Produção</span><b>{fq(saldoItem)} → {fq(saldoItem - qT)}</b></div>
                          <div><span>{nomeUnidade(destino)}</span><b>{fq(qtdEm(destino, item.id))} → {fq(qtdEm(destino, item.id) + qT)}</b></div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="field">
                <label htmlFor="contagem">Quantidade contada na produção</label>
                <QtdInput id="contagem" base={item.unidade_medida} texto={contagem.texto} medida={contagem.medida}
                  onChange={(texto, medida) => setContagem({ texto, medida })} />
                <p className="dica">Use para corrigir o estoque depois de uma contagem. Para enviar a uma loja, use &quot;Enviar para loja&quot;: assim a loja recebe junto.</p>
              </div>
            )}
          </>
        )}
      </Sheet>

      {/* ---------- registrar produção ---------- */}
      <Sheet
        aberto={produzindo}
        titulo="Registrar produção"
        subtitulo="O que foi produzido entra no estoque da produção"
        onFechar={() => setProduzindo(false)}
        rodape={
          <>
            <button className="bt bt-sec" onClick={() => setProduzindo(false)}>Cancelar</button>
            <button className="bt bt-prim" onClick={produzir} disabled={salvando || !preparo || !(qProd > 0)}>
              <IcoProducao size={17} /> {salvando ? 'Registrando…' : 'Registrar'}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="prep">Preparo</label>
          <select id="prep" value={preparoId} onChange={(e) => setPreparoId(e.target.value)}>
            {preparos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="qtd-prod">Quanto foi produzido</label>
          <QtdInput id="qtd-prod" base={basePreparo} texto={qtdProduzida.texto} medida={qtdProduzida.medida} placeholder="0"
            onChange={(texto, medida) => setQtdProduzida({ texto, medida })} />
          {preparo && <p className="dica">A receita rende {fmtQtd(rendimento, preparo.unidade_medida)} por lote.</p>}
        </div>

        {receita.length === 0 ? (
          <p className="dica" style={{ color: 'var(--gold)' }}>
            Esse preparo ainda não tem receita. Monte-a na tela Preparos para descontar os insumos automaticamente.
          </p>
        ) : (
          <>
            <label className="marcar">
              <input type="checkbox" checked={baixarInsumos} onChange={(e) => setBaixarInsumos(e.target.checked)} />
              Descontar os insumos usados do estoque da produção
            </label>
            {baixarInsumos && (
              <div className="comp">
                {consumo.map((c, idx) => (
                  <div className="comp-l" key={idx}>
                    <div className="item-main">
                      <b>{c.ing?.nome || '—'}</b>
                      <span>tem {fmtQtd(c.tem, c.ing?.unidade_medida)} na produção</span>
                    </div>
                    <div className="comp-c" style={{ width: 'auto', color: c.precisa > c.tem ? 'var(--red)' : undefined }}>
                      −{fmtQtd(c.precisa, c.ing?.unidade_medida)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {falta && (
              <p className="dica" style={{ color: 'var(--red)' }}>
                Algum insumo vai ficar negativo na produção. Confira se as compras foram lançadas para a Produção ou corrija a contagem.
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
