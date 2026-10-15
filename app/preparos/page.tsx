'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoLixo, IcoMais, IcoSeta } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';

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

const paraNumero = (s: string) => Number(String(s).replace(',', '.'));
const qtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v || 0);

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
  const [novaMedida, setNovaMedida] = useState('kg');
  const [novoRendimento, setNovoRendimento] = useState('');
  const [criando, setCriando] = useState(false);

  // receita aberta
  const [aberto, setAberto] = useState<Ingrediente | null>(null);
  const [rendimento, setRendimento] = useState('');
  const [novoInsumo, setNovoInsumo] = useState('');
  const [novaQtd, setNovaQtd] = useState('');
  const [qtds, setQtds] = useState<Record<string, string>>({});
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
      setQtds(Object.fromEntries(lista.map((i) => [i.id, qtd(Number(i.quantidade)).replace(/\./g, '')])));
    }
    // mantém a janela aberta com os dados novos
    setAberto((a) => (a ? todos.find((i) => i.id === a.id) || null : null));
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

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
    const rend = paraNumero(novoRendimento);
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
    setNovoRendimento('');
    await carregarDados();
    if (data) abrirReceita(data);
  }

  function abrirReceita(p: Ingrediente) {
    setRendimento(qtd(Number(p.rendimento_receita || 1)).replace(/\./g, ''));
    setNovoInsumo('');
    setNovaQtd('');
    setAberto(p);
  }

  async function salvarRendimento() {
    if (!aberto) return;
    const valor = paraNumero(rendimento);
    if (valor === Number(aberto.rendimento_receita || 1)) return;
    if (!(valor > 0)) return avisar('Rendimento inválido.', 'erro');
    const { error } = await supabase.from('ingredientes').update({ rendimento_receita: valor }).eq('id', aberto.id);
    if (error) return avisar('Erro ao atualizar: ' + error.message, 'erro');
    avisar('Rendimento atualizado.');
    carregarDados();
  }

  async function adicionarInsumo(e: React.FormEvent) {
    e.preventDefault();
    if (!aberto) return;
    const ing = brutos.find((i) => i.nome.toLowerCase() === novoInsumo.trim().toLowerCase());
    if (!ing) return avisar('Escolha um insumo da lista.', 'erro');
    const quantidade = paraNumero(novaQtd);
    if (!(quantidade > 0)) return avisar('Informe a quantidade usada no lote.', 'erro');

    setSalvandoItem(true);
    const { error } = await supabase.from('preparo_itens').insert({ insumo_pai_id: aberto.id, ingrediente_id: ing.id, quantidade });
    setSalvandoItem(false);
    if (error) return avisar('Erro ao adicionar: ' + error.message, 'erro');
    setNovoInsumo('');
    setNovaQtd('');
    carregarDados();
  }

  async function salvarQtd(item: ItemPreparo) {
    const valor = paraNumero(qtds[item.id] || '');
    if (valor === Number(item.quantidade)) return;
    if (!(valor > 0)) {
      avisar('Quantidade inválida.', 'erro');
      return setQtds({ ...qtds, [item.id]: qtd(Number(item.quantidade)) });
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
              return (
                <button key={p.id} className="item" onClick={() => abrirReceita(p)}>
                  <div className="item-main">
                    <div className="item-tit">
                      {p.nome}
                      {cp.itens === 0 && <span className="tag o">Montar receita</span>}
                    </div>
                    <div className="item-sub">
                      Lote rende {qtd(cp.rendimento)} {p.unidade_medida} · custa {brl(cp.lote)}
                    </div>
                  </div>
                  <div className="item-dir">
                    <div className="item-val">{brl(cp.porUnidade)}</div>
                    <div className="item-mini">por {p.unidade_medida}</div>
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
              <select id="pr-medida" value={novaMedida} onChange={(e) => setNovaMedida(e.target.value)}>
                {['kg', 'g', 'L', 'ml', 'un'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pr-rend">Rendimento do lote</label>
              <div className="inp-un">
                <input id="pr-rend" inputMode="decimal" value={novoRendimento} onChange={(e) => setNovoRendimento(e.target.value)} placeholder="Ex: 2,5" required />
                <span>{novaMedida}</span>
              </div>
            </div>
          </div>
          <p className="dica">Rendimento = quanto sai de cada lote preparado. Ele divide o custo do lote.</p>
        </form>
      </Sheet>

      {/* ---------- receita ---------- */}
      <Sheet aberto={!!aberto} titulo="Receita" subtitulo={aberto?.nome} onFechar={() => setAberto(null)}>
        {aberto && c && (
          <>
            <div className="resumo">
              <div><span>Custo do lote</span><b>{brl(c.lote)}</b></div>
              <div><span>Rendimento</span><b>{qtd(c.rendimento)} {aberto.unidade_medida}</b></div>
              <div><span>Custo por {aberto.unidade_medida}</span><b className="o">{brl(c.porUnidade)}</b></div>
            </div>

            <div className="field">
              <label htmlFor="rend">Rendimento do lote</label>
              <div className="inp-un">
                <input
                  id="rend" inputMode="decimal" value={rendimento} onChange={(e) => setRendimento(e.target.value)}
                  onBlur={salvarRendimento} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                <span>{aberto.unidade_medida}</span>
              </div>
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
                      <span>{brl(custoUn)} / {item.ingredientes?.unidade_medida}</span>
                    </div>
                    <div className="comp-q">
                      <input
                        className="inp" inputMode="decimal" aria-label={`Quantidade de ${item.ingredientes?.nome}`}
                        value={qtds[item.id] ?? ''} onChange={(e) => setQtds({ ...qtds, [item.id]: e.target.value })}
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
                <input inputMode="decimal" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} placeholder="Qtd" aria-label="Quantidade" />
              </div>
              <button type="submit" className="bt bt-prim bt-ic" disabled={salvandoItem} aria-label="Adicionar insumo" style={{ height: 48, width: 48 }}>
                <IcoMais size={20} />
              </button>
            </form>
            <p className="dica">Quantidade usada em um lote, na medida do insumo.</p>
          </>
        )}
      </Sheet>
    </>
  );
}
