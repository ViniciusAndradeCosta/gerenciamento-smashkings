'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import QtdInput from '@/components/QtdInput';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoEstoque, IcoPreparos, IcoSeta, IcoAjuste } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { BASES, campoQtd, custoPor, fmtQtd, lerCampo, mesmaFamilia, normalizar, qtdPartes, rotulo, textoEm, type CampoQtd, type Medida } from '@/lib/medidas';

type Unidade = { id: string; nome: string; codigo?: string; cor?: string; e_producao?: boolean };
type Ingrediente = { id: string; nome: string; unidade_medida: string; custo_medio: number; e_produzido_internamente: boolean; estoque_minimo?: number };
type Estoque = { unidade_id: string; ingrediente_id: string; quantidade: number };
type Status = 'esgotado' | 'acabando' | 'normal';

const STATUS: Record<Status, { txt: string; tag: string; ordem: number }> = {
  esgotado: { txt: 'Esgotado', tag: 'r', ordem: 0 },
  acabando: { txt: 'Acabando', tag: 'o', ordem: 1 },
  normal: { txt: 'Normal', tag: 'g', ordem: 2 },
};

export default function EstoquePage() {
  const supabase = createClient();

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [unidadeFiltro, setUnidadeFiltro] = useState('Todas');
  const [tipo, setTipo] = useState<'insumos' | 'preparos'>('insumos');
  const [busca, setBusca] = useState('');

  // janela do insumo: ajustar estoque ou editar o cadastro
  const [ajustando, setAjustando] = useState<Ingrediente | null>(null);
  const [aba, setAba] = useState<'ajustar' | 'editar'>('ajustar');
  const [editQtds, setEditQtds] = useState<Record<string, CampoQtd>>({});
  const [editMinimo, setEditMinimo] = useState<CampoQtd>({ texto: '', medida: 'un' });
  const [editNome, setEditNome] = useState('');
  const [editMedida, setEditMedida] = useState<Medida>('un');
  const [salvando, setSalvando] = useState(false);

  async function carregarDados() {
    setCarregando(true);
    const [resUni, resIng, resEst, resCusto] = await Promise.all([
      supabase.from('unidades').select('*').order('nome'),
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('estoque').select('*'),
      supabase.from('v_custo_ingrediente').select('ingrediente_id, custo_unitario'),
    ]);

    // Custo efetivo: CMP para insumos comprados e custo do lote / rendimento
    // para preparos (que não têm compra e ficariam com custo zero).
    const custoDe = new Map((resCusto.data || []).map((c) => [c.ingrediente_id, Number(c.custo_unitario)]));
    if (resUni.data) setUnidades(resUni.data);
    if (resIng.data) setIngredientes(resIng.data.map((i) => ({ ...i, custo_medio: custoDe.get(i.id) ?? i.custo_medio })));
    if (resEst.data) setEstoques(resEst.data);
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  // a produção (cozinha central) tem tela própria: aqui ficam só as lojas
  // ('geral' cobre bancos que ainda não rodaram o schema novo)
  const lojas = useMemo(() => unidades.filter((u) => !u.e_producao && u.codigo !== 'geral'), [unidades]);
  const idsLojas = useMemo(() => new Set(lojas.map((u) => u.id)), [lojas]);
  const unidadeDe = (id: string) => lojas.find((u) => u.id === id);
  const qtdNaUnidade = (ingId: string, uniId: string) =>
    Number(estoques.find((e) => e.ingrediente_id === ingId && e.unidade_id === uniId)?.quantidade || 0);

  // linhas já calculadas: quantidade no filtro atual, status e valor
  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ingredientes
      .filter((ing) => (tipo === 'preparos' ? ing.e_produzido_internamente === true : !ing.e_produzido_internamente))
      .map((ing) => {
        const doIngrediente = estoques.filter((e) => e.ingrediente_id === ing.id && idsLojas.has(e.unidade_id));
        const qtdAtual = unidadeFiltro === 'Todas'
          ? doIngrediente.reduce((s, e) => s + (Number(e.quantidade) || 0), 0)
          : qtdNaUnidade(ing.id, unidadeFiltro);
        const minimo = Number(ing.estoque_minimo || 0);
        // com uma unidade filtrada, o status é o daquela unidade
        const status: Status = qtdAtual <= 0 ? 'esgotado' : minimo > 0 && qtdAtual <= minimo ? 'acabando' : 'normal';
        return { ing, doIngrediente, qtdAtual, minimo, status, valor: qtdAtual * Number(ing.custo_medio || 0) };
      })
      .sort((a, b) => STATUS[a.status].ordem - STATUS[b.status].ordem || a.ing.nome.localeCompare(b.ing.nome, 'pt-BR'))
      .filter((l) => !termo || l.ing.nome.toLowerCase().includes(termo));
  }, [ingredientes, estoques, tipo, unidadeFiltro, busca, idsLojas]);

  const valorTotal = linhas.reduce((s, l) => s + l.valor, 0);
  const emAlerta = linhas.filter((l) => l.status !== 'normal').length;

  function abrirInsumo(ing: Ingrediente) {
    const mapa: Record<string, CampoQtd> = {};
    lojas.forEach((u) => { mapa[u.id] = campoQtd(qtdNaUnidade(ing.id, u.id), ing.unidade_medida); });
    setEditQtds(mapa);
    setEditMinimo(campoQtd(Number(ing.estoque_minimo || 0), ing.unidade_medida));
    setEditNome(ing.nome);
    setEditMedida(normalizar(ing.unidade_medida));
    setAba('ajustar');
    setAjustando(ing);
  }

  async function salvarAjuste() {
    if (!ajustando) return;
    const ingredienteId = ajustando.id;
    const base = ajustando.unidade_medida;
    // O supabase-js não lança exceção: devolve { error }. Sem checar, uma
    // falha (ex.: gerente ajustando outra unidade) parecia ter sido salva.
    const conferir = ({ error }: { error: { message: string } | null }) => {
      if (error) throw new Error(error.message);
    };

    const alvo = unidadeFiltro === 'Todas' ? lojas : lojas.filter((u) => u.id === unidadeFiltro);
    const novos = new Map<string, number>();
    for (const u of alvo) {
      const val = lerCampo(editQtds[u.id], base, 0);
      if (isNaN(val) || val < 0) { avisar(`Quantidade inválida em ${u.nome}.`, 'erro'); return; }
      novos.set(u.id, val);
    }
    const minVal = lerCampo(editMinimo, base, 0);
    if (isNaN(minVal) || minVal < 0) return avisar('Mínimo inválido.', 'erro');

    setSalvando(true);
    try {
      if (Math.abs(minVal - Number(ajustando.estoque_minimo || 0)) > 1e-9) {
        conferir(await supabase.from('ingredientes').update({ estoque_minimo: minVal }).eq('id', ingredienteId));
      }

      for (const u of alvo) {
        const val = novos.get(u.id)!;
        const match = estoques.find((e) => e.unidade_id === u.id && e.ingrediente_id === ingredienteId);
        if (match) {
          if (Math.abs(Number(match.quantidade) - val) < 1e-9) continue;
          conferir(await supabase.from('estoque').update({ quantidade: val }).eq('unidade_id', u.id).eq('ingrediente_id', ingredienteId));
        } else {
          if (val === 0) continue;
          conferir(await supabase.from('estoque').insert({ unidade_id: u.id, ingrediente_id: ingredienteId, quantidade: val }));
        }
      }

      avisar(`Estoque de ${ajustando.nome} atualizado.`);
      setAjustando(null);
      await carregarDados();
    } catch (err: any) {
      avisar('Erro ao salvar estoque: ' + err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCadastro() {
    if (!ajustando) return;
    const nome = editNome.trim();
    if (!nome) return avisar('Informe o nome do insumo.', 'erro');
    if (nome.toLowerCase() !== ajustando.nome.toLowerCase() && ingredientes.some((i) => i.id !== ajustando.id && i.nome.toLowerCase() === nome.toLowerCase())) {
      return avisar('Já existe outro insumo com esse nome.', 'erro');
    }

    setSalvando(true);
    try {
      if (nome !== ajustando.nome) {
        const { error } = await supabase.from('ingredientes').update({ nome }).eq('id', ajustando.id);
        if (error) throw error;
      }
      if (editMedida !== normalizar(ajustando.unidade_medida)) {
        const { error } = await supabase.rpc('trocar_medida_insumo', { p_ingrediente: ajustando.id, p_nova: editMedida });
        if (error) throw error;
      }
      avisar('Insumo atualizado.');
      setAjustando(null);
      await carregarDados();
    } catch (err: any) {
      avisar('Erro ao salvar: ' + err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  const unidadeAtual = unidadeFiltro === 'Todas' ? null : unidadeDe(unidadeFiltro);
  const unidadesDoAjuste = unidadeFiltro === 'Todas' ? lojas : lojas.filter((u) => u.id === unidadeFiltro);
  const medidaAtual = ajustando ? normalizar(ajustando.unidade_medida) : 'un';
  const trocaMedida = !!ajustando && editMedida !== medidaAtual;
  // bases kg, L e un (+ a atual, se o insumo vier de antes com g ou ml):
  // converter sempre para a medida maior não perde precisão nos custos
  const opcoesMedida = BASES.some((b) => b.medida === medidaAtual)
    ? BASES
    : [{ medida: medidaAtual, nome: `${ajustando ? rotulo(ajustando.unidade_medida) : medidaAtual} (atual)` }, ...BASES];

  return (
    <>
      <PageHeader titulo="Estoque" subtitulo={unidadeAtual ? `Loja ${unidadeAtual.nome}` : 'Lojas · a cozinha central fica em Produção'}>
        <div className="chips" role="group" aria-label="Filtrar por unidade">
          <button className={'chip' + (unidadeFiltro === 'Todas' ? ' act' : '')} onClick={() => setUnidadeFiltro('Todas')}>Todas</button>
          {lojas.map((u) => (
            <button key={u.id} className={'chip' + (unidadeFiltro === u.id ? ' act' : '')} onClick={() => setUnidadeFiltro(u.id)}>
              <span className="ud" style={{ background: u.cor || 'var(--gold)' }} />
              {u.nome}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="pg">
        <div className="resumo">
          <div><span>Valor em estoque</span><b>{brl(valorTotal)}</b></div>
          <div><span>Em alerta</span><b className={emAlerta ? 'r' : 'g'}>{emAlerta}</b></div>
          <div><span>{tipo === 'preparos' ? 'Preparos' : 'Insumos'}</span><b>{linhas.length}</b></div>
        </div>

        <div className="filtros">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={tipo === 'insumos'} className={tipo === 'insumos' ? 'act' : ''} onClick={() => setTipo('insumos')}>
              <IcoEstoque size={16} /> Insumos
            </button>
            <button role="tab" aria-selected={tipo === 'preparos'} className={tipo === 'preparos' ? 'act' : ''} onClick={() => setTipo('preparos')}>
              <IcoPreparos size={16} /> Preparos
            </button>
          </div>
          <label className="busca">
            <IcoBusca size={17} />
            <input className="inp" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar insumo…" aria-label="Buscar insumo" />
          </label>
        </div>

        <div className="lista">
          {carregando ? (
            <div className="vazio">Carregando estoque…</div>
          ) : linhas.length === 0 ? (
            <div className="vazio">{busca ? `Nada encontrado para "${busca}".` : tipo === 'preparos' ? 'Nenhum preparo cadastrado ainda.' : 'Nenhum insumo cadastrado ainda. Eles aparecem aqui ao registrar compras.'}</div>
          ) : (
            linhas.map(({ ing, doIngrediente, qtdAtual, minimo, status, valor }) => {
              const partes = qtdPartes(qtdAtual, ing.unidade_medida);
              return (
                <button key={ing.id} className="item" onClick={() => abrirInsumo(ing)}>
                  <div className="item-main">
                    <div className="item-tit">
                      {ing.nome}
                      <span className={'tag ' + STATUS[status].tag}>{STATUS[status].txt}</span>
                    </div>
                    <div className="item-sub">
                      {custoPor(Number(ing.custo_medio || 0), ing.unidade_medida)}
                      {minimo > 0 && <> · mínimo {fmtQtd(minimo, ing.unidade_medida)}</>}
                    </div>
                    {unidadeFiltro === 'Todas' && doIngrediente.some((e) => Number(e.quantidade) > 0) && (
                      <div className="pilulas">
                        {doIngrediente.filter((e) => Number(e.quantidade) > 0).map((e) => {
                          const u = unidadeDe(e.unidade_id);
                          return u ? (
                            <span key={e.unidade_id} className="pilula">
                              <span className="ud" style={{ background: u.cor || 'var(--gold)' }} />
                              {u.nome} <b>{fmtQtd(Number(e.quantidade), ing.unidade_medida)}</b>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="item-dir">
                    <div className="item-val" style={{ color: status === 'esgotado' ? 'var(--red)' : status === 'acabando' ? 'var(--gold)' : undefined }}>
                      {partes.numero}<small>{partes.medida}</small>
                    </div>
                    <div className="item-mini">{brl(valor)}</div>
                  </div>
                  <IcoSeta size={16} className="item-chev" />
                </button>
              );
            })
          )}
        </div>
      </div>

      <Sheet
        aberto={!!ajustando}
        titulo={ajustando?.nome || ''}
        subtitulo={ajustando ? `Controlado em ${rotulo(ajustando.unidade_medida)}` : ''}
        onFechar={() => setAjustando(null)}
        rodape={
          <>
            <button className="bt bt-sec" onClick={() => setAjustando(null)}>Cancelar</button>
            {aba === 'ajustar'
              ? <button className="bt bt-prim" onClick={salvarAjuste} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar estoque'}</button>
              : <button className="bt bt-prim" onClick={salvarCadastro} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar insumo'}</button>}
          </>
        }
      >
        {ajustando && (
          <>
            <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
              <button role="tab" aria-selected={aba === 'ajustar'} className={aba === 'ajustar' ? 'act' : ''} onClick={() => setAba('ajustar')}>
                <IcoEstoque size={16} /> Ajustar estoque
              </button>
              <button role="tab" aria-selected={aba === 'editar'} className={aba === 'editar' ? 'act' : ''} onClick={() => setAba('editar')}>
                <IcoAjuste size={16} /> Editar insumo
              </button>
            </div>

            {aba === 'ajustar' ? (
              <>
                <div className="sheet-sec">Quantidade contada</div>
                {unidadesDoAjuste.map((u) => (
                  <div className="field" key={u.id}>
                    <label htmlFor={'q-' + u.id}>
                      <span className="ud-inline" style={{ background: u.cor || 'var(--gold)' }} /> {u.nome}
                    </label>
                    <QtdInput
                      id={'q-' + u.id} base={ajustando.unidade_medida}
                      texto={editQtds[u.id]?.texto ?? ''} medida={editQtds[u.id]?.medida ?? medidaAtual}
                      onChange={(texto, medida) => setEditQtds({ ...editQtds, [u.id]: { texto, medida } })}
                    />
                  </div>
                ))}
                <div className="sheet-sec" style={{ marginTop: 18 }}>Alerta</div>
                <div className="field">
                  <label htmlFor="minimo">Avisar quando ficar abaixo de</label>
                  <QtdInput id="minimo" base={ajustando.unidade_medida} texto={editMinimo.texto} medida={editMinimo.medida}
                    placeholder="Ex: 5" onChange={(texto, medida) => setEditMinimo({ texto, medida })} />
                  <p className="dica">O mesmo mínimo vale para todas as lojas. Deixe 0 para não avisar.</p>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="ed-nome">Nome</label>
                  <input id="ed-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="ed-medida">Medida em que é controlado</label>
                  <select id="ed-medida" value={editMedida} onChange={(e) => setEditMedida(e.target.value as Medida)}>
                    {opcoesMedida.map((m) => <option key={m.medida} value={m.medida}>{m.nome}</option>)}
                  </select>
                  {trocaMedida && (mesmaFamilia(medidaAtual, editMedida) ? (
                    <p className="dica" style={{ color: 'var(--grn)' }}>
                      Estoque, compras, fichas e preparos serão convertidos: 1.000 {rotulo(medidaAtual)} viram {textoEm(1000, medidaAtual, editMedida)} {rotulo(editMedida)}.
                    </p>
                  ) : (
                    <p className="dica" style={{ color: 'var(--red)' }}>
                      De {rotulo(medidaAtual)} para {rotulo(editMedida)} não dá para converter: só o rótulo muda. Use para corrigir um cadastro errado e confira o estoque e as fichas depois.
                    </p>
                  ))}
                  {!trocaMedida && <p className="dica">Na hora de lançar, dá para digitar em g ou kg, ml ou L — não precisa mudar a medida para isso.</p>}
                </div>
              </>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
