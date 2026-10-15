'use client';

import { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/PageHeader';
import Sheet from '@/components/Sheet';
import { avisar } from '@/components/Toaster';
import { IcoBusca, IcoCustos, IcoMais, IcoSeta, IcoLixo } from '@/components/Icons';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { CATEGORIAS } from '@/lib/categorias';

type Produto = {
  id: string;
  nome: string;
  preco_venda: number;
  custo_fixo?: number;
  categoria?: string | null;
  id_consumer: string | null;
  id_goomer: string | null;
  id_ifood: string | null;
  ativo: boolean;
};

type Form = { nome: string; preco: string; categoria: string; consumer: string; goomer: string; ifood: string };
const FORM_VAZIO: Form = { nome: '', preco: '', categoria: '', consumer: '', goomer: '', ifood: '' };
const paraNumero = (s: string) => Number(String(s).replace(',', '.'));

export default function ProdutosPage() {
  const supabase = createClient();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('Todos');
  const [busca, setBusca] = useState('');

  // janela de cadastro/edição: null = fechada, 'novo' ou o produto em edição
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  // janela do custo fixo
  const [custoAberto, setCustoAberto] = useState(false);
  const [configId, setConfigId] = useState('');
  const [custoFixo, setCustoFixo] = useState('');
  const [salvandoCusto, setSalvandoCusto] = useState(false);

  async function carregarProdutos() {
    setCarregando(true);
    const { data, error } = await supabase.from('produtos').select('*').order('nome');
    if (!error && data) setProdutos(data);
    setCarregando(false);
  }

  useEffect(() => { carregarProdutos(); }, []);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      if (filtro === 'Todos') return true;
      if (filtro === 'Sem categoria') return !p.categoria || !p.categoria.trim();
      return p.categoria === filtro;
    });
  }, [produtos, filtro, busca]);

  const contagem = (cat: string) => produtos.filter((p) => p.categoria === cat).length;
  const semCategoria = produtos.filter((p) => !p.categoria || !p.categoria.trim()).length;

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setEditando('novo');
  }

  function abrirEdicao(p: Produto) {
    setForm({
      nome: p.nome,
      preco: String(p.preco_venda ?? '').replace('.', ','),
      categoria: p.categoria || '',
      consumer: p.id_consumer || '',
      goomer: p.id_goomer || '',
      ifood: p.id_ifood || '',
    });
    setEditando(p);
  }

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar('Informe o nome do produto.', 'erro');
    setSalvando(true);

    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      preco_venda: paraNumero(form.preco) || 0,
      categoria: form.categoria || null,
      id_consumer: form.consumer.trim() || null,
      id_goomer: form.goomer.trim() || null,
      id_ifood: form.ifood.trim() || null,
    };

    let error;
    if (editando === 'novo') {
      const { data: config } = await supabase.from('configuracoes_loja').select('custo_fixo_padrao').limit(1).maybeSingle();
      ({ error } = await supabase.from('produtos').insert({ ...payload, custo_fixo: config?.custo_fixo_padrao ?? 1.5, ativo: true }));
    } else if (editando) {
      ({ error } = await supabase.from('produtos').update(payload).eq('id', editando.id));
    }

    setSalvando(false);
    if (error) return avisar('Erro ao salvar produto: ' + error.message, 'erro');
    avisar(editando === 'novo' ? 'Produto cadastrado.' : 'Produto atualizado.');
    setEditando(null);
    carregarProdutos();
  }

  async function alternarStatus(p: Produto) {
    const { error } = await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) return avisar('Erro ao alterar status: ' + error.message, 'erro');
    avisar(p.ativo ? 'Produto desativado.' : 'Produto ativado.');
    setEditando(null);
    carregarProdutos();
  }

  async function apagarProduto(p: Produto) {
    if (!confirm(`Apagar o produto "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('produtos').delete().eq('id', p.id);
    if (error) {
      // 23503 = chave estrangeira: o produto já aparece em vendas
      return avisar(error.code === '23503'
        ? 'Este produto já tem vendas registradas e não pode ser apagado. Use "Desativar".'
        : 'Erro ao apagar produto: ' + error.message, 'erro');
    }
    avisar('Produto apagado.');
    setEditando(null);
    carregarProdutos();
  }

  // ---------- custo fixo (vale para todos os produtos e preparos) ----------
  async function abrirCustoFixo() {
    setCustoAberto(true);
    setCustoFixo('');
    const { data } = await supabase.from('configuracoes_loja').select('*').limit(1);
    if (data && data.length > 0) {
      setConfigId(data[0].id);
      const val = data[0].custo_fixo_padrao ?? data[0].custo_salao_padrao;
      if (val !== undefined && val !== null) return setCustoFixo(String(val).replace('.', ','));
    }
    const primeiro = produtos[0];
    setCustoFixo(String(primeiro?.custo_fixo ?? 1.5).replace('.', ','));
  }

  async function salvarCustoFixo(e: React.FormEvent) {
    e.preventDefault();
    const valor = paraNumero(custoFixo);
    if (isNaN(valor) || valor < 0) return avisar('Informe um valor válido.', 'erro');
    setSalvandoCusto(true);
    try {
      if (configId) {
        const { error } = await supabase.from('configuracoes_loja').update({ custo_fixo_padrao: valor, updated_at: new Date().toISOString() }).eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('configuracoes_loja').insert([{ custo_fixo_padrao: valor }]).select();
        if (error) throw error;
        if (data && data[0]) setConfigId(data[0].id);
      }
      const { error: erroProdutos } = await supabase.from('produtos').update({ custo_fixo: valor }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (erroProdutos) throw erroProdutos;
      const { error: erroPreparos } = await supabase.from('ingredientes').update({ custo_fixo: valor }).eq('e_produzido_internamente', true);
      if (erroPreparos) throw erroPreparos;

      avisar(`Custo fixo de ${brl(valor)} aplicado a todos os produtos e preparos.`);
      setCustoAberto(false);
      carregarProdutos();
    } catch (err: any) {
      avisar('Erro ao salvar custo fixo: ' + err.message, 'erro');
    } finally {
      setSalvandoCusto(false);
    }
  }

  const campo = (k: keyof Form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }) });
  const produtoEditado = editando && editando !== 'novo' ? editando : null;

  return (
    <>
      <PageHeader
        titulo="Produtos"
        subtitulo={`${produtos.length} no cardápio · ${produtos.filter((p) => !p.ativo).length} inativos`}
        acoes={
          <>
            <button className="bt bt-sec bt-ic-mob" onClick={abrirCustoFixo} aria-label="Custo fixo">
              <IcoCustos size={17} /><span>Custo fixo</span>
            </button>
            <button className="bt bt-prim bt-ic-mob" onClick={abrirNovo} aria-label="Novo produto">
              <IcoMais size={17} /><span>Novo</span>
            </button>
          </>
        }
      />

      <div className="pg">
        <div className="filtros">
          <label className="busca">
            <IcoBusca size={17} />
            <input className="inp" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" aria-label="Buscar produto" />
          </label>
          <div className="chips" role="group" aria-label="Filtrar por categoria">
            <button className={'chip' + (filtro === 'Todos' ? ' act' : '')} onClick={() => setFiltro('Todos')}>Todos <span className="n">{produtos.length}</span></button>
            {CATEGORIAS.filter((c) => contagem(c) > 0).map((cat) => (
              <button key={cat} className={'chip' + (filtro === cat ? ' act' : '')} onClick={() => setFiltro(cat)}>
                {cat} <span className="n">{contagem(cat)}</span>
              </button>
            ))}
            {semCategoria > 0 && (
              <button className={'chip' + (filtro === 'Sem categoria' ? ' act' : '')} onClick={() => setFiltro('Sem categoria')}>
                Sem categoria <span className="n">{semCategoria}</span>
              </button>
            )}
          </div>
        </div>

        <div className="lista">
          {carregando ? (
            <div className="vazio">Carregando produtos…</div>
          ) : lista.length === 0 ? (
            <div className="vazio">
              {produtos.length === 0 ? 'Nenhum produto cadastrado ainda. Toque em "Novo" para começar.' : 'Nenhum produto nesse filtro.'}
            </div>
          ) : (
            lista.map((p) => (
              <button key={p.id} className={'item' + (p.ativo ? '' : ' off')} onClick={() => abrirEdicao(p)}>
                <div className="item-main">
                  <div className="item-tit">
                    {p.nome}
                    {!p.ativo && <span className="tag r">Inativo</span>}
                  </div>
                  <div className="item-sub">{p.categoria || 'Sem categoria'}</div>
                  {(p.id_consumer || p.id_goomer || p.id_ifood) && (
                    <div className="pilulas">
                      {p.id_consumer && <span className="pilula">Consumer <b>{p.id_consumer}</b></span>}
                      {p.id_goomer && <span className="pilula">Goomer <b>{p.id_goomer}</b></span>}
                      {p.id_ifood && <span className="pilula">iFood <b>{p.id_ifood}</b></span>}
                    </div>
                  )}
                </div>
                <div className="item-dir">
                  <div className="item-val" style={{ color: 'var(--gold)' }}>{brl(p.preco_venda)}</div>
                </div>
                <IcoSeta size={16} className="item-chev" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---------- cadastrar / editar produto ---------- */}
      <Sheet
        aberto={!!editando}
        titulo={editando === 'novo' ? 'Novo produto' : 'Editar produto'}
        subtitulo={produtoEditado ? produtoEditado.nome : 'Preencha os dados do cardápio'}
        onFechar={() => setEditando(null)}
        rodape={
          <>
            {produtoEditado && (
              <button type="button" className="bt bt-perigo bt-ic" onClick={() => apagarProduto(produtoEditado)} aria-label="Apagar produto">
                <IcoLixo size={18} />
              </button>
            )}
            {produtoEditado && (
              <button type="button" className="bt bt-sec" onClick={() => alternarStatus(produtoEditado)}>
                {produtoEditado.ativo ? 'Desativar' : 'Ativar'}
              </button>
            )}
            <button type="submit" form="form-produto" className="bt bt-prim" disabled={salvando}>
              {salvando ? 'Salvando…' : editando === 'novo' ? 'Cadastrar' : 'Salvar'}
            </button>
          </>
        }
      >
        <form id="form-produto" onSubmit={salvarProduto}>
          <div className="field">
            <label htmlFor="p-nome">Nome do produto</label>
            <input id="p-nome" {...campo('nome')} placeholder="Ex: King Classic Simples" required />
          </div>
          <div className="field2">
            <div className="field">
              <label htmlFor="p-cat">Categoria</label>
              <select id="p-cat" {...campo('categoria')} required>
                <option value="">Selecione…</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="p-preco">Preço de venda</label>
              <div className="inp-un">
                <input id="p-preco" inputMode="decimal" {...campo('preco')} placeholder="0,00" required />
                <span>R$</span>
              </div>
            </div>
          </div>
          <div className="sheet-sec" style={{ marginTop: 6 }}>Códigos nos sistemas de venda</div>
          <div className="field3">
            <div className="field">
              <label htmlFor="p-consumer">Consumer</label>
              <input id="p-consumer" {...campo('consumer')} placeholder="Bela Vista" />
            </div>
            <div className="field">
              <label htmlFor="p-goomer">Goomer</label>
              <input id="p-goomer" {...campo('goomer')} placeholder="J. Monlevade" />
            </div>
            <div className="field">
              <label htmlFor="p-ifood">iFood</label>
              <input id="p-ifood" {...campo('ifood')} placeholder="—" />
            </div>
          </div>
        </form>
      </Sheet>

      {/* ---------- custo fixo ---------- */}
      <Sheet
        aberto={custoAberto}
        titulo="Custo fixo"
        subtitulo="Embalagem, gás, energia… por produto"
        onFechar={() => setCustoAberto(false)}
        rodape={
          <>
            <button type="button" className="bt bt-sec" onClick={() => setCustoAberto(false)}>Cancelar</button>
            <button type="submit" form="form-custo" className="bt bt-prim" disabled={salvandoCusto || !custoFixo}>
              {salvandoCusto ? 'Aplicando…' : 'Aplicar a tudo'}
            </button>
          </>
        }
      >
        <form id="form-custo" onSubmit={salvarCustoFixo}>
          <p className="nota" style={{ marginBottom: 16 }}>
            Esse valor é somado ao custo dos insumos de <strong>cada produto</strong> e de <strong>cada lote de preparo</strong>.
            Ao salvar, ele é aplicado a todos de uma vez.
          </p>
          <div className="field">
            <label htmlFor="custo-fixo">Custo fixo por produto</label>
            <div className="inp-un">
              <input id="custo-fixo" inputMode="decimal" value={custoFixo} onChange={(e) => setCustoFixo(e.target.value)} placeholder={custoFixo ? '' : 'Carregando…'} required />
              <span>R$</span>
            </div>
          </div>
        </form>
      </Sheet>
    </>
  );
}
