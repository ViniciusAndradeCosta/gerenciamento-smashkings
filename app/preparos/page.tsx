'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import QtdInput from '@/components/QtdInput';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoLixo, IcoMais, IcoSeta } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { BASES, campoQtd, campoVazio, custoPartes, custoPor, fmtQtd, lerCampo, type CampoQtd, type Medida } from '@/lib/medidas';

type Ingrediente = {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_medio?: number;
  custo_fixo?: number;
  custo_salao?: number;
  e_produzido_internamente?: boolean;
  rendimento_receita?: number;
};
type ItemPreparo = { id: string; insumo_pai_id: string; ingrediente_id: string; quantidade: number; ingredientes?: Ingrediente };


export default function PreparosPage() {
  const supabase = createClient();
  const [preparos, setPreparos] = useState<Ingrediente[]>([]);
  const [brutos, setBrutos] = useState<Ingrediente[]>([]);
  const [itens, setItens] = useState<ItemPreparo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  // novo preparo
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaMedida, setNovaMedida] = useState<Medida>('kg');
  const [novoRendimento, setNovoRendimento] = useState<CampoQtd>({ texto: '', medida: 'kg' });
  const [criando, setCriando] = useState(false);

  // receita aberta
  const [aberto, setAberto] = useState<Ingrediente | null>(null);
  const [rendimento, setRendimento] = useState<CampoQtd>(campoVazio());
  const [novoInsumo, setNovoInsumo] = useState('');
  const [novaQtd, setNovaQtd] = useState<CampoQtd>(campoVazio());
  const [qtds, setQtds] = useState<Record<string, CampoQtd>>({});
  const [salvandoItem, setSalvandoItem] = useState(false);

  async function carregarDados() {
    const [resIng, resItens] = await Promise.all([
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('preparo_itens').select('*'),
    ]);
    const todos = resIng.data || [];
    setPreparos(todos.filter((i) => i.e_produzido_internamente));
    setBrutos(todos.filter((i) => !i.e_produzido_internamente));
    if (resItens.data) {
      const lista = resItens.data.map((item) => ({ ...item, ingredientes: todos.find((ing) => ing.id === item.ingrediente_id) }));
      setItens(lista);
      setQtds(Object.fromEntries(lista.map((i) => [i.id, campoQtd(Number(i.quantidade), i.ingredientes?.unidade_medida)])));
    }
    // mantém a janela aberta com os dados novos
    setAberto((a) => (a ? todos.find((i) => i.id === a.id) || null : null));
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  // insumo escolhido para adicionar: o campo passa para a medida dele (g, ml ou un)
  const ingNovo = brutos.find((i) => i.nome.toLowerCase() === novoInsumo.trim().toLowerCase());
  const baseNova = ingNovo?.unidade_medida;
  useEffect(() => { setNovaQtd((q) => ({ ...campoVazio(baseNova), texto: q.texto })); }, [baseNova]);

  // mesma conta da view v_custo_ingrediente: (insumos + custo fixo) / rendimento
  const custos = useMemo(() => {
    const m = new Map<string, { insumos: number; fixo: number; lote: number; porUnidade: number; rendimento: number; itens: number }>();
    for (const p of preparos) {
      const comp = itens.filter((i) => i.insumo_pai_id === p.id);
      const insumos = comp.reduce((s, i) => s + Number(i.quantidade) * Number(i.ingredientes?.custo_medio || 0), 0);
      const fixo = Number(p.custo_fixo ?? p.custo_salao ?? 1.5);
      const rend = Number(p.rendimento_receita || 1);
      const lote = insumos + fixo;
      m.set(p.id, { insumos, fixo, lote, porUnidade: rend > 0 ? lote / rend : 0, rendimento: rend, itens: comp.length });
    }
    return m;
  }, [preparos, itens]);

  const lista = preparos.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  async function criarPreparo(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    const rend = lerCampo(novoRendimento, novaMedida);
    if (!nome || !(rend > 0)) return avisar('Informe o nome e um rendimento maior que zero.', 'erro');
    if ([...preparos, ...brutos].some((i) => i.nome.toLowerCase().trim() === nome.toLowerCase())) {
      return avisar('Já existe um insumo com esse nome.', 'erro');
    }

    setCriando(true);
    const { data: config } = await supabase.from('configuracoes_loja').select('custo_fixo_padrao').limit(1).maybeSingle();
    const { data, error } = await supabase.from('ingredientes').insert({
      nome,
      unidade_medida: novaMedida,
      e_produzido_internamente: true,
      rendimento_receita: rend,
      custo_fixo: config?.custo_fixo_padrao ?? 1.5,
      ativo: true,
    }).select().single();
    setCriando(false);

    if (error) return avisar('Erro ao criar preparo: ' + error.message, 'erro');
    avisar(`${nome} criado. Agora monte a receita.`);
    setNovoAberto(false);
    setNovoNome('');
    setNovoRendimento({ texto: '', medida: novaMedida });
    await carregarDados();
    if (data) abrirReceita(data);
  }

  function abrirReceita(p: Ingrediente) {
    setRendimento(campoQtd(Number(p.rendimento_receita || 1), p.unidade_medida));
    setNovoInsumo('');
    setNovaQtd(campoVazio());
    setAberto(p);
  }

  async function salvarRendimento() {
    if (!aberto) return;
    const valor = lerCampo(rendimento, aberto.unidade_medida);
    if (Math.abs(valor - Number(aberto.rendimento_receita || 1)) < 1e-9) return;
    if (!(valor > 0)) {
      avisar('Rendimento inválido.', 'erro');
      return setRendimento(campoQtd(Number(aberto.rendimento_receita || 1), aberto.unidade_medida));
    }
    const { error } = await supabase.from('ingredientes').update({ rendimento_receita: valor }).eq('id', aberto.id);
    if (error) return avisar('Erro ao atualizar: ' + error.message, 'erro');
    avisar('Rendimento atualizado.');
    carregarDados();
  }

  async function adicionarInsumo(e: React.FormEvent) {
    e.preventDefault();
    if (!aberto) return;
    const ing = ingNovo;
    if (!ing) return avisar('Escolha um insumo da lista.', 'erro');
    const quantidade = lerCampo(novaQtd, ing.unidade_medida);
    if (!(quantidade > 0)) return avisar('Informe a quantidade usada no lote.', 'erro');

    setSalvandoItem(true);
    const { error } = await supabase.from('preparo_itens').insert({ insumo_pai_id: aberto.id, ingrediente_id: ing.id, quantidade });
    setSalvandoItem(false);
    if (error) return avisar('Erro ao adicionar: ' + error.message, 'erro');
    setNovoInsumo('');
    setNovaQtd(campoVazio());
    carregarDados();
  }

  async function salvarQtd(item: ItemPreparo) {
    const base = item.ingredientes?.unidade_medida;
    const valor = lerCampo(qtds[item.id], base);
    if (Math.abs(valor - Number(item.quantidade)) < 1e-9) return;
    if (!(valor > 0)) {
      avisar('Quantidade inválida.', 'erro');
      return setQtds({ ...qtds, [item.id]: campoQtd(Number(item.quantidade), base) });
    }
    const { error } = await supabase.from('preparo_itens').update({ quantidade: valor }).eq('id', item.id);
    if (error) return avisar('Erro ao editar: ' + error.message, 'erro');
    avisar('Quantidade atualizada.');
    carregarDados();
  }

  async function removerItem(item: ItemPreparo) {
    if (!confirm(`Remover ${item.ingredientes?.nome || 'este insumo'} da receita?`)) return;
    const { error } = await supabase.from('preparo_itens').delete().eq('id', item.id);
    if (error) return avisar('Erro ao remover: ' + error.message, 'erro');
    carregarDados();
  }

  const c = aberto ? custos.get(aberto.id) : undefined;
  const cuAberto = custoPartes(c?.porUnidade || 0, aberto?.unidade_medida);
  const comp = aberto ? itens.filter((i) => i.insumo_pai_id === aberto.id).sort((a, b) => (a.ingredientes?.nome || '').localeCompare(b.ingredientes?.nome || '', 'pt-BR')) : [];

  return (
    <>
      <PageHeader
        titulo="Preparos"
        subtitulo="Molhos e sub-receitas feitos na casa"
        acoes={
          <button className="bt bt-prim bt-ic-mob" onClick={() => setNovoAberto(true)} aria-label="Novo preparo">
            <IcoMais size={17} /><span>Novo preparo</span>
          </button>
        }
      />

      <div className="pg">
        {preparos.length > 0 && (
          <div className="filtros">
            <label className="busca">
              <IcoBusca size={17} />
              <input className="inp" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar preparo…" aria-label="Buscar preparo" />
            </label>
          </div>
        )}

        <div className="lista">
          {carregando ? (
            <div className="vazio">Carregando receitas…</div>
          ) : preparos.length === 0 ? (
            <div className="vazio">
              Nenhum preparo cadastrado.<br />Toque em <b style={{ color: 'var(--gold)' }}>Novo preparo</b> para criar um molho ou sub-receita.
            </div>
          ) : lista.length === 0 ? (
            <div className="vazio">Nada encontrado para &quot;{busca}&quot;.</div>
          ) : (
            lista.map((p) => {
              const cp = custos.get(p.id)!;
              const cu = custoPartes(cp.porUnidade, p.unidade_medida);
              return (
                <button key={p.id} className="item" onClick={() => abrirReceita(p)}>
                  <div className="item-main">
                    <div className="item-tit">
                      {p.nome}
                      {cp.itens === 0 && <span className="tag o">Montar receita</span>}
                    </div>
                    <div className="item-sub">
                      Lote rende {fmtQtd(cp.rendimento, p.unidade_medida)} · custa {brl(cp.lote)}
                    </div>
                  </div>
                  <div className="item-dir">
                    <div className="item-val">{brl(cu.preco)}</div>
                    <div className="item-mini">por {cu.medida}</div>
                  </div>
                  <IcoSeta size={16} className="item-chev" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---------- novo preparo ---------- */}
      <Sheet
        aberto={novoAberto}
        titulo="Novo preparo"
        subtitulo="Depois você monta a receita"
        onFechar={() => setNovoAberto(false)}
        rodape={
          <>
            <button type="button" className="bt bt-sec" onClick={() => setNovoAberto(false)}>Cancelar</button>
            <button type="submit" form="form-preparo" className="bt bt-prim" disabled={criando}>{criando ? 'Criando…' : 'Criar e montar receita'}</button>
          </>
        }
      >
        <form id="form-preparo" onSubmit={criarPreparo}>
          <div className="field">
            <label htmlFor="pr-nome">Nome</label>
            <input id="pr-nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Molho da Casa" required />
          </div>
          <div className="field2">
            <div className="field">
              <label htmlFor="pr-medida">Medida</label>
              <select id="pr-medida" value={novaMedida} onChange={(e) => {
                const m = e.target.value as Medida;
                setNovaMedida(m);
                setNovoRendimento({ texto: novoRendimento.texto, medida: m });
              }}>
                {BASES.map((b) => <option key={b.medida} value={b.medida}>{b.nome}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pr-rend">Rendimento do lote</label>
              <QtdInput id="pr-rend" base={novaMedida} texto={novoRendimento.texto} medida={novoRendimento.medida} placeholder="Ex: 2,5"
                onChange={(texto, medida) => setNovoRendimento({ texto, medida })} />
            </div>
          </div>
          <p className="dica">Rendimento = quanto sai de cada lote preparado (ex.: 800 g ou 2,5 kg). Ele divide o custo do lote.</p>
        </form>
      </Sheet>

      {/* ---------- receita ---------- */}
      <Sheet aberto={!!aberto} titulo="Receita" subtitulo={aberto?.nome} onFechar={() => setAberto(null)}>
        {aberto && c && (
          <>
            <div className="resumo">
              <div><span>Custo do lote</span><b>{brl(c.lote)}</b></div>
              <div><span>Rendimento</span><b>{fmtQtd(c.rendimento, aberto.unidade_medida)}</b></div>
              <div><span>Custo por {cuAberto.medida}</span><b className="o">{brl(cuAberto.preco)}</b></div>
            </div>

            <div className="field">
              <label htmlFor="rend">Rendimento do lote</label>
              <QtdInput
                id="rend" base={aberto.unidade_medida} texto={rendimento.texto} medida={rendimento.medida}
                onChange={(texto, medida) => setRendimento({ texto, medida })}
                onBlur={salvarRendimento} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </div>

            <div className="sheet-sec">Insumos do lote</div>
            <div className="comp">
              {comp.length === 0 && <div className="vazio">Nenhum insumo ainda. Adicione abaixo.</div>}
              {comp.map((item) => {
                const custoUn = Number(item.ingredientes?.custo_medio || 0);
                return (
                  <div className="comp-l" key={item.id}>
                    <div className="item-main">
                      <b>{item.ingredientes?.nome || '—'}</b>
                      <span>{custoPor(custoUn, item.ingredientes?.unidade_medida)}</span>
                    </div>
                    <div className="comp-q">
                      <QtdInput
                        base={item.ingredientes?.unidade_medida} rotuloAria={`Quantidade de ${item.ingredientes?.nome}`}
                        texto={qtds[item.id]?.texto ?? ''} medida={qtds[item.id]?.medida ?? 'un'}
                        onChange={(texto, medida) => setQtds({ ...qtds, [item.id]: { texto, medida } })}
                        onBlur={() => salvarQtd(item)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    </div>
                    <div className="comp-c">{brl(Number(item.quantidade) * custoUn)}</div>
                    <button className="bt bt-ic bt-sm bt-ghost" onClick={() => removerItem(item)} aria-label={`Remover ${item.ingredientes?.nome}`}>
                      <IcoLixo size={16} />
                    </button>
                  </div>
                );
              })}
              <div className="comp-l comp-tot">
                <div className="item-main"><span>Insumos {brl(c.insumos)} + custo fixo {brl(c.fixo)}</span></div>
                <div className="comp-c">{brl(c.lote)}</div>
              </div>
            </div>

            <div className="sheet-sec">Adicionar insumo</div>
            <form className="add-linha" onSubmit={adicionarInsumo}>
              <div className="field">
                <input list="lista-ingredientes-brutos" value={novoInsumo} onChange={(e) => setNovoInsumo(e.target.value)} placeholder="Insumo" aria-label="Insumo" autoComplete="off" />
                <datalist id="lista-ingredientes-brutos">
                  {brutos.map((ing) => <option key={ing.id} value={ing.nome} />)}
                </datalist>
              </div>
              <div className="field">
                <QtdInput base={baseNova} texto={novaQtd.texto} medida={novaQtd.medida} placeholder="Qtd" rotuloAria="Quantidade"
                  onChange={(texto, medida) => setNovaQtd({ texto, medida })} />
              </div>
              <button type="submit" className="bt bt-prim bt-ic" disabled={salvandoItem} aria-label="Adicionar insumo" style={{ height: 48, width: 48 }}>
                <IcoMais size={20} />
              </button>
            </form>
            <p className="dica">Quantidade usada em um lote — digite em g ou kg, ml ou L, como for mais prático.</p>
          </>
        )}
      </Sheet>
    </>
  );
}
