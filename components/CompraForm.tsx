'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { avisar } from './Toaster';
import QtdInput from './QtdInput';
import { brl } from '@/lib/format';
import { BASES, compativeis, converterPreco, custoPor, fmtQtd, lerNumero, lerQtd, normalizar, rotulo, type Medida } from '@/lib/medidas';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string };

export default function CompraForm({
  unidades, ingredientes, fornecedores, unidadeInicial,
}: {
  unidades: Opt[]; ingredientes: Opt[]; fornecedores: Opt[]; unidadeInicial?: string;
}) {
  const router = useRouter();
  const [unidade, setUnidade] = useState(unidadeInicial || unidades[0]?.id || '');
  const [ingredienteInput, setIngredienteInput] = useState('');
  const [fornecedorInput, setFornecedorInput] = useState('');
  const [medidaNova, setMedidaNova] = useState<Medida>('kg');
  const [qtdTexto, setQtdTexto] = useState('');
  const [qtdMedida, setQtdMedida] = useState<Medida>('kg');
  const [precoTexto, setPrecoTexto] = useState('');
  // preço por kg, por g… ou o total pago (quando só se tem o valor da nota)
  const [precoModo, setPrecoModo] = useState<Medida | 'total'>('kg');
  const [carregando, setCarregando] = useState(false);

  const ingEncontrado = ingredientes.find((i) => i.nome.toLowerCase().trim() === ingredienteInput.toLowerCase().trim());
  const ingredienteNovo = !ingEncontrado && ingredienteInput.trim() !== '';
  const base = ingEncontrado?.unidade_medida || medidaNova;

  // trocou de insumo (ou de medida do insumo novo): volta para a medida dele
  useEffect(() => {
    setQtdMedida(normalizar(base));
    setPrecoModo(normalizar(base));
  }, [base]);

  const qBase = lerQtd(qtdTexto, qtdMedida, base);
  const p = lerNumero(precoTexto);
  const precoBase = precoModo === 'total' ? p / qBase : converterPreco(p, precoModo, base);
  const totalPrevisto = qBase * precoBase;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!ingredienteInput.trim()) return avisar('Informe o insumo.', 'erro');
    if (!(qBase > 0)) return avisar('Informe uma quantidade maior que zero.', 'erro');
    if (!(precoBase >= 0) || !isFinite(precoBase)) return avisar('Informe um preço válido.', 'erro');

    setCarregando(true);
    const supabase = createClient();

    try {
      let idDoIngrediente = ingEncontrado?.id || null;
      let idDoFornecedor = null;

      // 1. Insumo: usa o existente ou cria um novo
      if (!idDoIngrediente) {
        const { data: novoIng, error: erroIng } = await supabase
          .from('ingredientes')
          .insert({ nome: ingredienteInput.trim(), unidade_medida: medidaNova, ativo: true })
          .select('id')
          .single();
        if (erroIng) throw new Error('Erro ao criar novo insumo: ' + erroIng.message);
        idDoIngrediente = novoIng.id;
      }

      // 2. Fornecedor (opcional): usa o existente ou cria um novo
      if (fornecedorInput.trim() !== '') {
        const existente = fornecedores.find((f) => f.nome.toLowerCase().trim() === fornecedorInput.toLowerCase().trim());
        if (existente) {
          idDoFornecedor = existente.id;
        } else {
          const { data: novoForn, error: erroForn } = await supabase
            .from('fornecedores')
            .insert({ nome: fornecedorInput.trim() })
            .select('id')
            .single();
          if (erroForn) throw new Error('Erro ao criar novo fornecedor: ' + erroForn.message);
          idDoFornecedor = novoForn.id;
        }
      }

      // 3. A compra, sempre na medida base do insumo (o banco soma ao
      // estoque e recalcula o custo médio)
      const { error: erroCompra } = await supabase.from('compras').insert({
        unidade_id: unidade,
        ingrediente_id: idDoIngrediente,
        fornecedor_id: idDoFornecedor,
        quantidade: qBase,
        preco_unitario: precoBase,
      });
      if (erroCompra) {
        throw new Error(erroCompra.message.includes('row-level security')
          ? 'Você não tem permissão para lançar compras nesta unidade.'
          : 'Erro ao salvar compra: ' + erroCompra.message);
      }

      avisar(`Compra registrada: ${fmtQtd(qBase, base)} de ${ingredienteInput.trim()}.`);
      setQtdTexto('');
      setPrecoTexto('');
      setIngredienteInput('');
      setFornecedorInput('');
      router.refresh();
    } catch (err: any) {
      avisar(err.message, 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      <div className="field">
        <label htmlFor="cf-unidade">Unidade</label>
        <select id="cf-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} required>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cf-insumo">Insumo</label>
        <input
          id="cf-insumo" list="lista-ingredientes" value={ingredienteInput}
          onChange={(e) => setIngredienteInput(e.target.value)}
          placeholder="Escolha da lista ou digite um novo" autoComplete="off" required
        />
        <datalist id="lista-ingredientes">
          {ingredientes.map((i) => <option key={i.id} value={i.nome} />)}
        </datalist>
        {ingredienteNovo && <p className="dica" style={{ color: 'var(--gold)' }}>Insumo novo — será cadastrado junto com a compra.</p>}
      </div>

      {/* Insumo novo: como ele é controlado (peso, líquido ou unidade) */}
      {ingredienteNovo && (
        <div className="field">
          <label htmlFor="cf-medida">Como controlar esse insumo</label>
          <select id="cf-medida" value={medidaNova} onChange={(e) => setMedidaNova(e.target.value as Medida)}>
            {BASES.map((b) => <option key={b.medida} value={b.medida}>{b.nome}</option>)}
          </select>
          <p className="dica">Em peso e líquido dá para lançar em g ou kg, ml ou L — o sistema converte.</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="cf-fornecedor">Fornecedor <span style={{ color: 'var(--mut2)', fontWeight: 500 }}>(opcional)</span></label>
        <input
          id="cf-fornecedor" list="lista-fornecedores" value={fornecedorInput}
          onChange={(e) => setFornecedorInput(e.target.value)} placeholder="Escolha ou digite um novo" autoComplete="off"
        />
        <datalist id="lista-fornecedores">
          {fornecedores.map((f) => <option key={f.id} value={f.nome} />)}
        </datalist>
      </div>

      <div className="field2">
        <div className="field">
          <label htmlFor="cf-qtd">Quantidade</label>
          <QtdInput id="cf-qtd" base={base} texto={qtdTexto} medida={qtdMedida} placeholder="0"
            onChange={(t, m) => { setQtdTexto(t); setQtdMedida(m); }} />
        </div>
        <div className="field">
          <label htmlFor="cf-preco">Preço (R$)</label>
          <div className="qtd-un">
            <input id="cf-preco" inputMode="decimal" value={precoTexto} onChange={(e) => setPrecoTexto(e.target.value)} placeholder="0,00" />
            <select value={precoModo} onChange={(e) => setPrecoModo(e.target.value as Medida | 'total')} aria-label="O preço é">
              {compativeis(base).map((m, _, todas) => <option key={m} value={m}>/{todas.length === 1 ? rotulo(base) : rotulo(m)}</option>)}
              <option value="total">total</option>
            </select>
          </div>
        </div>
      </div>

      <div className="total-linha">
        <span>
          Total da compra
          {qBase > 0 && precoBase > 0 && isFinite(precoBase) && (
            <small style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
              {fmtQtd(qBase, base)} · {custoPor(precoBase, base)}
            </small>
          )}
        </span>
        <b>{totalPrevisto > 0 && isFinite(totalPrevisto) ? brl(totalPrevisto) : '—'}</b>
      </div>

      <button type="submit" className="btn prim" disabled={carregando}>
        {carregando ? 'Registrando…' : 'Registrar compra'}
      </button>
    </form>
  );
}
