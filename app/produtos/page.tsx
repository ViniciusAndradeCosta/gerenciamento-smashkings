'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';

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

const CATEGORIAS = [
  'Burguer Simples',
  'Burguer Duplo',
  'Burguer Triplo',
  'Burguer Alto',
  'Burguer do mês',
  'Veggies',
  'Molho Adicional',
  'Acompanhamentos',
  'Milkshakes'
];

export default function ProdutosPage() {
  const supabase = createClient();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estado para o Filtro
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');

  // Estado para cadastro de novo produto
  const [nome, setNome] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [idConsumer, setIdConsumer] = useState('');
  const [idGoomer, setIdGoomer] = useState('');
  const [idIfood, setIdIfood] = useState('');

  // Estado para modal de edição
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPrecoVenda, setEditPrecoVenda] = useState('');
  const [editCategoria, setEditCategoria] = useState('');
  const [editIdConsumer, setEditIdConsumer] = useState('');
  const [editIdGoomer, setEditIdGoomer] = useState('');
  const [editIdIfood, setEditIdIfood] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  async function carregarProdutos() {
    setCarregando(true);
    const { data, error } = await supabase.from('produtos').select('*').order('nome');
    if (!error && data) {
      setProdutos(data);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  // Cadastrar novo produto
  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);

    const { data: config } = await supabase.from('configuracoes_loja').select('*').limit(1).single();

    const payload = {
      nome: nome.trim(),
      preco_venda: Number(precoVenda.replace(',', '.')) || 0,
      custo_fixo: config?.custo_fixo_padrao || 1.50,
      categoria: categoria || null,
      id_consumer: idConsumer.trim() || null,
      id_goomer: idGoomer.trim() || null,
      id_ifood: idIfood.trim() || null,
      ativo: true,
    };

    const { error } = await supabase.from('produtos').insert(payload);
    if (error) {
      alert('Erro ao cadastrar produto: ' + error.message);
    } else {
      setNome('');
      setPrecoVenda('');
      setCategoria('');
      setIdConsumer('');
      setIdGoomer('');
      setIdIfood('');
      await carregarProdutos();
    }

    setCarregando(false);
  }

  // Abrir Modal de Edição
  function abrirModalEdicao(prod: Produto) {
    setProdutoEditando(prod);
    setEditNome(prod.nome);
    setEditPrecoVenda(String(prod.preco_venda ?? ''));
    setEditCategoria(prod.categoria || '');
    setEditIdConsumer(prod.id_consumer || '');
    setEditIdGoomer(prod.id_goomer || '');
    setEditIdIfood(prod.id_ifood || '');
  }

  // Salvar alterações da edição
  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!produtoEditando) return;

    setSalvandoEdicao(true);

    const payload = {
      nome: editNome.trim(),
      preco_venda: Number(String(editPrecoVenda).replace(',', '.')) || 0,
      categoria: editCategoria || null,
      id_consumer: editIdConsumer.trim() || null,
      id_goomer: editIdGoomer.trim() || null,
      id_ifood: editIdIfood.trim() || null,
    };

    const { error } = await supabase
      .from('produtos')
      .update(payload)
      .eq('id', produtoEditando.id);

    if (error) {
      alert('Erro ao atualizar produto: ' + error.message);
    } else {
      setProdutoEditando(null);
      await carregarProdutos();
    }

    setSalvandoEdicao(false);
  }

  async function alternarStatus(prod: Produto) {
    const { error } = await supabase
      .from('produtos')
      .update({ ativo: !prod.ativo })
      .eq('id', prod.id);

    if (!error) {
      carregarProdutos();
    }
  }

  async function apagarProduto(id: string, nomeProd: string) {
    if (!confirm(`Tem certeza que deseja apagar o produto "${nomeProd}"?`)) return;
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      alert('Erro ao apagar produto: ' + error.message);
    } else {
      carregarProdutos();
    }
  }

  const produtosFiltrados = produtos.filter(prod => {
    if (filtroCategoria === 'Todos') return true;
    if (filtroCategoria === 'Sem Categoria') return !prod.categoria || prod.categoria.trim() === '';
    return prod.categoria === filtroCategoria;
  });

  return (
    <>
      <TopBar titulo="Gerenciamento de Produtos" showCustoFixo={true} />

      <style dangerouslySetInnerHTML={{__html: `
        .scroll-chips::-webkit-scrollbar { height: 6px; }
        .scroll-chips::-webkit-scrollbar-track { background: transparent; }
        .scroll-chips::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; }
        .scroll-chips::-webkit-scrollbar-thumb:hover { background: var(--dim); }

        /* CLASSES RESPONSIVAS PARA O FORMULÁRIO */
        .form-row-2-1-1 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .form-row-1-1-1 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .input-group { display: flex; flex-direction: column; justify-content: flex-end; }

        @media (max-width: 768px) {
          /* No celular, empilha os campos um debaixo do outro para não espremer */
          .form-row-2-1-1, .form-row-1-1-1 { grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }
        }
      `}} />

      <div className="wrap">
        <div className="lbl">Cadastrar Novo Produto</div>

        <div className="panel" style={{ padding: '20px', marginBottom: '24px' }}>
          <form onSubmit={handleCadastrar}>
            
            {/* LINHA 1 */}
            <div className="form-row-2-1-1">
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Nome do Produto</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: King Classic Simples" style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Categoria</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required>
                  <option value="">Selecione...</option>
                  {CATEGORIAS.map((cat) => ( <option key={cat} value={cat}>{cat}</option> ))}
                </select>
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Preço de Venda (R$)</label>
                <input type="text" placeholder="0,00" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required />
              </div>
            </div>

            {/* LINHA 2 (IDS DE INTEGRAÇÃO) */}
            <div className="form-row-1-1-1">
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID Consumer (Bela Vista)</label>
                <input type="text" value={idConsumer} onChange={(e) => setIdConsumer(e.target.value)} placeholder="Ex: 105" style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID Goomer (João Monlevade)</label>
                <input type="text" value={idGoomer} onChange={(e) => setIdGoomer(e.target.value)} placeholder="Ex: 992" style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID iFood</label>
                <input type="text" value={idIfood} onChange={(e) => setIdIfood(e.target.value)} placeholder="Ex: 504" style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
              </div>
            </div>

            <button type="submit" disabled={carregando} style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}>
              {carregando ? 'Cadastrando...' : '+ Cadastrar Produto'}
            </button>
          </form>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="scroll-chips" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '8px' }}>
          {['Todos', ...CATEGORIAS, 'Sem Categoria'].map((cat) => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ padding: '8px 16px', whiteSpace: 'nowrap', background: filtroCategoria === cat ? 'var(--gold)' : 'var(--surf)', color: filtroCategoria === cat ? '#000' : 'var(--txt)', border: filtroCategoria === cat ? 'none' : '1px solid var(--line)', borderRadius: '20px', fontWeight: filtroCategoria === cat ? 'bold' : 'normal', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s' }}>
              {cat}
            </button>
          ))}
        </div>

        {/* LISTAGEM DE PRODUTOS */}
        <div className="lbl" style={{ marginTop: '16px' }}>Produtos Cadastrados ({produtosFiltrados.length})</div>

        <div className="panel">
          {produtosFiltrados.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: '1px solid var(--line)', opacity: p.ativo ? 1 : 0.5 }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b style={{ color: 'var(--txt)', fontSize: 16 }}>{p.nome}</b>
                  {!p.ativo && ( <span style={{ fontSize: 11, background: 'var(--rdim)', color: 'var(--red)', padding: '2px 6px', borderRadius: '4px' }}>Inativo</span> )}
                </div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 'bold' }}>Venda: {brl(p.preco_venda)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--dim)' }}>
                  Consumer: <b>{p.id_consumer || '—'}</b> · Goomer: <b>{p.id_goomer || '—'}</b> · iFood: <b>{p.id_ifood || '—'}</b>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
                <button onClick={() => abrirModalEdicao(p)} style={{ background: 'var(--surf)', color: 'var(--txt)', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 13 }}>Editar</button>
                <button onClick={() => alternarStatus(p)} style={{ background: 'var(--surf)', color: p.ativo ? 'var(--gold)' : 'var(--grn)', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 13 }}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => apagarProduto(p.id, p.nome)} style={{ background: 'var(--rdim)', color: 'var(--red)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 13 }}>Apagar</button>
              </div>
            </div>
          ))}

          {produtosFiltrados.length === 0 && !carregando && (
            <div className="vazio" style={{ padding: '24px', textAlign: 'center' }}>Nenhum produto encontrado na categoria "{filtroCategoria}".</div>
          )}
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {produtoEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="panel custom-scroll" style={{ width: '100%', maxWidth: '650px', padding: '24px', borderRadius: '12px', background: 'var(--bg)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--line)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: 'var(--txt)' }}>Editar Produto</h3>
              <button onClick={() => setProdutoEditando(null)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSalvarEdicao}>
              <div className="form-row-2-1-1">
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Nome do Produto</label>
                  <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Categoria</label>
                  <select value={editCategoria} onChange={(e) => setEditCategoria(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map((cat) => ( <option key={cat} value={cat}>{cat}</option> ))}
                  </select>
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>Preço de Venda (R$)</label>
                  <input type="text" value={editPrecoVenda} onChange={(e) => setEditPrecoVenda(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} required />
                </div>
              </div>

              <div className="form-row-1-1-1">
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID Consumer</label>
                  <input type="text" value={editIdConsumer} onChange={(e) => setEditIdConsumer(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID Goomer</label>
                  <input type="text" value={editIdGoomer} onChange={(e) => setEditIdGoomer(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--dim)' }}>ID iFood</label>
                  <input type="text" value={editIdIfood} onChange={(e) => setEditIdIfood(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--txt)', borderRadius: '8px', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: '8px' }}>
                <button type="submit" disabled={salvandoEdicao} style={{ flex: 1, padding: '12px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                <button type="button" onClick={() => setProdutoEditando(null)} style={{ padding: '12px 20px', background: 'var(--surf)', color: 'var(--txt)', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}