'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoLixo, IcoMais, IcoSeta } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl, num } from '@/lib/format';
import { CATEGORIAS } from '@/lib/categorias';

type Produto = { id: string; nome: string; preco_venda: number; custo_fixo?: number; custo_extra?: number; categoria?: string | null; ativo: boolean };
type Ingrediente = { id: string; nome: string; unidade_medida: string; custo_medio: number };
type FichaItem = { id: string; produto_id: string; ingrediente_id: string; quantidade: number; ingredientes?: Ingrediente };

const paraNumero = (s: string) => Number(String(s).replace(',', '.'));
const qtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v || 0);
const custoFixoDe = (p: Produto) => Number(p.custo_fixo ?? p.custo_extra ?? 1.5);

export default function FichasPage() {
  const supabase = createClient();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [fichas, setFichas] = useState<FichaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  const [aberto, setAberto] = useState<Produto | null>(null);
  const [novoInsumo, setNovoInsumo] = useState('');
  const [novaQtd, setNovaQtd] = useState('');
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [salvandoItem, setSalvandoItem] = useState(false);

  async function carregarDados() {
    const [resProd, resIng, resFichas, resCusto] = await Promise.all([
      supabase.from('produtos').select('*').order('nome'),
      supabase.from('ingredientes').select('*').order('nome'),
      supabase.from('ficha_itens').select('*'),
      supabase.from('v_custo_ingrediente').select('ingrediente_id, custo_unitario'),
    ]);

    // Custo efetivo de cada insumo (preparos/molhos usam o custo da receita,
    // não o CMP de compra, que para eles é zero). Mesma conta do CMV.
    const custoDe = new Map((resCusto.data || []).map((c) => [c.ingrediente_id, Number(c.custo_unitario)]));
    const ings: Ingrediente[] = (resIng.data || []).map((i) => ({ ...i, custo_medio: custoDe.get(i.id) ?? i.custo_medio }));

    if (resProd.data) setProdutos(resProd.data);
    setIngredientes(ings);
    if (resFichas.data) {
      const itens = resFichas.data.map((item) => ({ ...item, ingredientes: ings.find((ing) => ing.id === item.ingrediente_id) }));
      setFichas(itens);
      setQtds(Object.fromEntries(itens.map((i) => [i.id, qtd(Number(i.quantidade)).replace(/\./g, '')])));
    }
    setCarregando(false);
  }

  useEffect(() => { carregarDados(); }, []);

  // custos de cada produto já calculados
  const custos = useMemo(() => {
    const m = new Map<string, { insumos: number; fixo: number; total: number; cmv: number; margem: number; itens: number }>();
    for (const p of produtos) {
      const itens = fichas.filter((f) => f.produto_id === p.id);
      const insumos = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.ingredientes?.custo_medio || 0), 0);
      const fixo = custoFixoDe(p);
      const total = insumos + fixo;
      const preco = Number(p.preco_venda || 0);
      m.set(p.id, { insumos, fixo, total, cmv: preco > 0 ? (total / preco) * 100 : 0, margem: preco > 0 ? ((preco - total) / preco) * 100 : 0, itens: itens.length });
    }
    return m;
  }, [produtos, fichas]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      if (filtro === 'Todos') return true;
      if (filtro === 'Sem ficha') return (custos.get(p.id)?.itens || 0) === 0;
      return p.categoria === filtro;
    });
  }, [produtos, filtro, busca, custos]);

  const semFicha = produtos.filter((p) => (custos.get(p.id)?.itens || 0) === 0).length;
  const comPreco = produtos.filter((p) => Number(p.preco_venda) > 0 && (custos.get(p.id)?.itens || 0) > 0);
  const cmvMedio = comPreco.length ? comPreco.reduce((s, p) => s + (custos.get(p.id)?.cmv || 0), 0) / comPreco.length : 0;

  async function adicionarInsumo(e: React.FormEvent) {
    e.preventDefault();
    if (!aberto) return;
    const ing = ingredientes.find((i) => i.nome.toLowerCase() === novoInsumo.trim().toLowerCase());
    if (!ing) return avisar('Escolha um insumo da lista.', 'erro');
    const quantidade = paraNumero(novaQtd);
    if (!(quantidade > 0)) return avisar('Informe a quantidade usada.', 'erro');

    setSalvandoItem(true);
    const { error } = await supabase.from('ficha_itens').insert({ produto_id: aberto.id, ingrediente_id: ing.id, quantidade });
    setSalvandoItem(false);
    if (error) return avisar('Erro ao adicionar: ' + error.message, 'erro');
    setNovoInsumo('');
    setNovaQtd('');
    carregarDados();
  }

  async function salvarQtd(item: FichaItem) {
    const valor = paraNumero(qtds[item.id] || '');
    if (valor === Number(item.quantidade)) return;
    if (!(valor > 0)) {
      avisar('Quantidade inválida.', 'erro');
      return setQtds({ ...qtds, [item.id]: qtd(Number(item.quantidade)) });
    }
    const { error } = await supabase.from('ficha_itens').update({ quantidade: valor }).eq('id', item.id);
    if (error) return avisar('Erro ao editar: ' + error.message, 'erro');
    avisar('Quantidade atualizada.');
    carregarDados();
  }

  async function removerItem(item: FichaItem) {
    if (!confirm(`Remover ${item.ingredientes?.nome || 'este insumo'} da ficha?`)) return;
    const { error } = await supabase.from('ficha_itens').delete().eq('id', item.id);
    if (error) return avisar('Erro ao remover: ' + error.message, 'erro');
    carregarDados();
  }

  const c = aberto ? custos.get(aberto.id) : undefined;
  const itensAbertos = aberto ? fichas.filter((f) => f.produto_id === aberto.id).sort((a, b) => (a.ingredientes?.nome || '').localeCompare(b.ingredientes?.nome || '', 'pt-BR')) : [];
  const corCmv = (cmv: number) => (cmv <= 0 ? 'n' : cmv <= 35 ? 'g' : cmv <= 45 ? 'o' : 'r');

  return (
    <>
      <PageHeader titulo="Fichas técnicas" subtitulo="Custo, CMV e margem de cada produto" />

      <div className="pg">
        <div className="resumo">
          <div><span>Produtos</span><b>{produtos.length}</b></div>
          <div><span>Sem ficha</span><b className={semFicha ? 'o' : 'g'}>{semFicha}</b></div>
          <div><span>CMV médio</span><b className={corCmv(cmvMedio)}>{cmvMedio ? `${num(cmvMedio, 1)}%` : '—'}</b></div>
        </div>

        <div className="filtros">
          <label className="busca">
            <IcoBusca size={17} />
            <input className="inp" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" aria-label="Buscar produto" />
          </label>
          <div className="chips" role="group" aria-label="Filtrar">
            <button className={'chip' + (filtro === 'Todos' ? ' act' : '')} onClick={() => setFiltro('Todos')}>Todos</button>
            {semFicha > 0 && (
              <button className={'chip' + (filtro === 'Sem ficha' ? ' act' : '')} onClick={() => setFiltro('Sem ficha')}>
                Sem ficha <span className="n">{semFicha}</span>
              </button>
            )}
            {CATEGORIAS.filter((cat) => produtos.some((p) => p.categoria === cat)).map((cat) => (
              <button key={cat} className={'chip' + (filtro === cat ? ' act' : '')} onClick={() => setFiltro(cat)}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="lista">
          {carregando ? (
            <div className="vazio">Carregando fichas…</div>
          ) : lista.length === 0 ? (
            <div className="vazio">{produtos.length === 0 ? 'Cadastre produtos na tela Produtos para montar as fichas.' : 'Nenhum produto nesse filtro.'}</div>
          ) : (
            lista.map((p) => {
              const cp = custos.get(p.id)!;
              return (
                <button key={p.id} className={'item' + (p.ativo ? '' : ' off')} onClick={() => setAberto(p)}>
                  <div className="item-main">
                    <div className="item-tit">
                      {p.nome}
                      {cp.itens === 0 && <span className="tag o">Sem ficha</span>}
                    </div>
                    <div className="item-sub">
                      Venda {brl(p.preco_venda)} · custo {brl(cp.total)}
                    </div>
                  </div>
                  <div className="item-dir">
                    {/* sem ficha o custo é só o fixo: um CMV baixo aqui enganaria */}
                    {cp.itens === 0 ? (
                      <div className="item-val" style={{ color: 'var(--mut2)' }}>—</div>
                    ) : Number(p.preco_venda) > 0 ? (
                      <>
                        <span className={'tag ' + corCmv(cp.cmv)}>CMV {num(cp.cmv, 1)}%</span>
                        <div className="item-mini">margem {num(cp.margem, 0)}%</div>
                      </>
                    ) : <span className="tag n">sem preço</span>}
                  </div>
                  <IcoSeta size={16} className="item-chev" />
                </button>
              );
            })
          )}
        </div>
      </div>

      <Sheet
        aberto={!!aberto}
        titulo="Ficha técnica"
        subtitulo={aberto ? `${aberto.nome}${aberto.categoria ? ' · ' + aberto.categoria : ''}` : ''}
        onFechar={() => setAberto(null)}
      >
        {aberto && c && (
          <>
            <div className="resumo">
              <div><span>Preço de venda</span><b className="o">{brl(aberto.preco_venda)}</b></div>
              <div><span>Custo total</span><b>{brl(c.total)}</b></div>
              <div><span>CMV · margem</span><b className={corCmv(c.cmv)}>{Number(aberto.preco_venda) > 0 ? `${num(c.cmv, 0)}% · ${num(c.margem, 0)}%` : '—'}</b></div>
            </div>

            <div className="sheet-sec">Composição</div>
            <div className="comp">
              {itensAbertos.length === 0 && <div className="vazio">Nenhum insumo ainda. Adicione abaixo.</div>}
              {itensAbertos.map((item) => {
                const custoUn = Number(item.ingredientes?.custo_medio || 0);
                return (
                  <div className="comp-l" key={item.id}>
                    <div className="item-main">
                      <b>{item.ingredientes?.nome || '—'}</b>
                      <span>{brl(custoUn)} / {item.ingredientes?.unidade_medida}</span>
                    </div>
                    <div className="comp-q inp-un">
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
                <div className="comp-c">{brl(c.total)}</div>
              </div>
            </div>

            <div className="sheet-sec">Adicionar insumo</div>
            <form className="add-linha" onSubmit={adicionarInsumo}>
              <div className="field">
                <input list="lista-fichas-ingredientes" value={novoInsumo} onChange={(e) => setNovoInsumo(e.target.value)} placeholder="Insumo ou preparo" aria-label="Insumo" autoComplete="off" />
                <datalist id="lista-fichas-ingredientes">
                  {ingredientes.map((ing) => <option key={ing.id} value={ing.nome} />)}
                </datalist>
              </div>
              <div className="field">
                <input inputMode="decimal" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} placeholder="Qtd" aria-label="Quantidade" />
              </div>
              <button type="submit" className="bt bt-prim bt-ic" disabled={salvandoItem} aria-label="Adicionar insumo" style={{ height: 48, width: 48 }}>
                <IcoMais size={20} />
              </button>
            </form>
            <p className="dica">A quantidade é na medida do insumo (ex.: 0,05 para 50 g de um insumo em kg).</p>
          </>
        )}
      </Sheet>
    </>
  );
}
