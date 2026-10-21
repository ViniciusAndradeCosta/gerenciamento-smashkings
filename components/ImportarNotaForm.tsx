'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { avisar } from './Toaster';
import { IcoCamera, IcoArquivo, IcoLixo, IcoNota } from './Icons';
import { brl } from '@/lib/format';
import { converter, lerNumero, normalizar, rotulo, textoEm, type Medida } from '@/lib/medidas';

type Opt = { id: string; nome: string; codigo?: string; unidade_medida?: string; e_producao?: boolean };
// quantidade e preço ficam como texto enquanto a pessoa edita (aceita vírgula)
type ItemNF = { id_temp: string; nome: string; quantidade: string; preco_total: string; unidade_medida: string };

const paraNumero = lerNumero;

// insumo novo é cadastrado na base da família: peso em kg, líquido em L
const BASE_DA_FAMILIA: Record<Medida, Medida> = { kg: 'kg', g: 'kg', l: 'l', ml: 'l', un: 'un' };
const paraTexto = (n: number) => String(n ?? '').replace('.', ',');

// A Vercel recusa requisições acima de ~4,5 MB, e foto de celular passa disso
// fácil. Reduz a imagem para no máximo 2000px (sobra nitidez para ler a nota).
const LIMITE_BYTES = 4 * 1024 * 1024;
async function prepararArquivo(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'nota.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // formato que o navegador não decodifica: envia como está
  }
}

/** Observação embaixo de cada item lido: para onde vai e em que medida. */
function NotaDestino({ existente, daNota, base, qBase, incompativel }: { existente?: Opt; daNota: Medida; base: string; qBase: number; incompativel: boolean }) {
  if (incompativel) {
    return (
      <p className="dica" style={{ color: 'var(--red)' }}>
        O cadastro está em {rotulo(base)} e a nota diz {rotulo(daNota)}. Corrija a medida ou o nome do insumo.
      </p>
    );
  }
  // a nota veio em outra medida (500 G num insumo em kg): mostra o valor que entra
  const conv = normalizar(base) !== daNota && qBase > 0 ? `${textoEm(qBase, base, normalizar(base))} ${rotulo(base)}` : '';
  return existente
    ? <p className="dica">Já cadastrado em {rotulo(base)}{conv && ` — entra como ${conv}`}.</p>
    : <p className="dica" style={{ color: 'var(--gold)' }}>Insumo novo — será cadastrado em {rotulo(base)}{conv && `, com ${conv}`}.</p>;
}

export default function ImportarNotaForm({
  unidades, ingredientes, unidadeInicial,
}: {
  unidades: Opt[]; ingredientes: Opt[]; unidadeInicial?: string;
}) {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [itens, setItens] = useState<ItemNF[]>([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(unidadeInicial || '');

  useEffect(() => {
    if (unidades.length > 0 && !unidadeSelecionada) {
      const padrao = unidades.find((u) => u.e_producao) || unidades.find((u) => u.codigo === 'producao' || u.codigo === 'geral' || u.nome.toLowerCase().includes('produção'));
      setUnidadeSelecionada(padrao ? padrao.id : unidades[0].id);
    }
  }, [unidades, unidadeSelecionada]);

  async function extrairDados(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;

    setLendo(true);
    const envio = await prepararArquivo(arquivo);
    if (envio.size > LIMITE_BYTES) {
      avisar('Arquivo muito grande (máx. 4 MB). Tire uma foto ou envie um PDF menor.', 'erro');
      setLendo(false);
      return;
    }
    const formData = new FormData();
    formData.append('file', envio);

    // --- BLINDAGEM DE IA (instrução estrita para o backend) ---
    const regraIA = `REGRA CRÍTICA DE EXTRAÇÃO: Ignore nomes de marcas (ex: Vitapão, Sadia, Heinz, Liza), pesos, medidas (ex: 1kg, 500g, 2L, 900ml) e numerações de lote. Extraia e retorne EXCLUSIVAMENTE o nome genérico, limpo e culinário do insumo. Exemplo: Se ler "ACUCAR MASCAVO VITAPAO 1KG", retorne APENAS "Açúcar Mascavo". Formate usando a primeira letra maiúscula em cada palavra.`;
    formData.append('instrucoes_extras', regraIA);

    try {
      const res = await fetch('/api/extrair-nf', { method: 'POST', body: formData });
      // Erros da plataforma (ex.: 413, 504) chegam como texto, não JSON
      const corpo = await res.text();
      let dados: any;
      try {
        dados = JSON.parse(corpo);
      } catch {
        throw new Error(
          res.status === 413 ? 'Arquivo muito grande para enviar.'
          : res.status === 504 ? 'A leitura demorou demais. Tente de novo.'
          : `Resposta inesperada do servidor (${res.status}).`
        );
      }
      if (!res.ok || dados.error) throw new Error(dados.error || 'Falha na comunicação com o servidor');

      // Limpeza caso a IA mande pesos no fim do nome (ex: "Açúcar Mascavo 1kg")
      const lidos: ItemNF[] = dados.map((item: any) => ({
        id_temp: item.id_temp,
        nome: String(item.nome).replace(/\s+\d+(,\d+)?\s*(kg|g|ml|l|mg|un|cx|pcte|pacote)s?$/i, '').trim(),
        quantidade: paraTexto(item.quantidade),
        preco_total: paraTexto(item.preco_total),
        unidade_medida: normalizar(item.unidade_medida),
      }));
      if (!lidos.length) throw new Error('Não encontrei itens nessa nota. Tente uma foto mais nítida.');
      setItens(lidos);
      avisar(`${lidos.length} ${lidos.length === 1 ? 'item lido' : 'itens lidos'}. Confira antes de salvar.`);
    } catch (error: any) {
      avisar(error.message, 'erro');
    } finally {
      setLendo(false);
    }
  }

  const mudar = (id: string, campo: keyof ItemNF, valor: string) =>
    setItens((lista) => lista.map((i) => (i.id_temp === id ? { ...i, [campo]: valor } : i)));
  const remover = (id: string) => setItens((lista) => lista.filter((i) => i.id_temp !== id));
  const totalNota = itens.reduce((s, i) => s + (paraNumero(i.preco_total) || 0), 0);

  /**
   * Para onde vai cada item e em que medida: a nota pode vir em g para um
   * insumo controlado em kg (500 g entram como 0,5 kg). Medidas que não se
   * convertem (un na nota, kg no cadastro) bloqueiam o lançamento.
   */
  function destino(item: ItemNF) {
    const existente = ingredientes.find((ing) => ing.nome.toLowerCase().trim() === item.nome.toLowerCase().trim());
    const daNota = normalizar(item.unidade_medida);
    const base = existente ? (existente.unidade_medida || 'un') : BASE_DA_FAMILIA[daNota];
    const qBase = converter(paraNumero(item.quantidade), daNota, base);
    return { existente, daNota, base, qBase, incompativel: isNaN(qBase) };
  }

  async function salvarNoBanco() {
    const invalido = itens.find((i) => !i.nome.trim() || !(paraNumero(i.quantidade) > 0) || isNaN(paraNumero(i.preco_total)));
    if (invalido) return avisar(`Confira o item "${invalido.nome || 'sem nome'}": nome, quantidade e preço.`, 'erro');
    const semConversao = itens.find((i) => destino(i).incompativel);
    if (semConversao) return avisar(`A medida de "${semConversao.nome}" não bate com o cadastro. Ajuste antes de lançar.`, 'erro');

    setSalvando(true);
    const supabase = createClient();
    let erros = 0;
    // Insumos criados nesta importação: se a nota tiver duas linhas do mesmo
    // produto novo, a segunda reaproveita o cadastro em vez de duplicar.
    const criados = new Map<string, string>();

    for (const item of itens) {
      const chave = item.nome.toLowerCase().trim();
      const { existente, base, qBase: quantidade } = destino(item);
      let idDoIngrediente = existente?.id || criados.get(chave) || null;

      if (!idDoIngrediente) {
        const { data: novo, error } = await supabase
          .from('ingredientes')
          .insert({ nome: item.nome.trim(), unidade_medida: base, ativo: true })
          .select('id')
          .single();
        if (error) { console.error(`Erro ao criar o insumo ${item.nome}:`, error); erros++; continue; }
        idDoIngrediente = novo.id;
        criados.set(chave, novo.id);
      }

      const { error: erroCompra } = await supabase.from('compras').insert({
        unidade_id: unidadeSelecionada,
        ingrediente_id: idDoIngrediente,
        quantidade,
        preco_unitario: paraNumero(item.preco_total) / quantidade,
        origem: 'nota_fiscal',
      });
      if (erroCompra) { console.error(`Erro ao salvar a compra de ${item.nome}:`, erroCompra); erros++; }
    }

    setSalvando(false);
    if (erros > 0) {
      avisar(`Salvo, mas ${erros} ${erros === 1 ? 'item deu' : 'itens deram'} erro. Confira as últimas compras.`, 'erro');
    } else {
      avisar('Todos os itens da nota foram lançados no estoque.');
      setItens([]);
      setArquivo(null);
    }
    router.refresh();
  }

  // ---------- etapa 2: revisar itens lidos ----------
  if (itens.length > 0) {
    return (
      <div>
        <div className="nf-cab">
          <div>
            <b>{itens.length} {itens.length === 1 ? 'item' : 'itens'} lidos</b>
            <span>Confira e corrija antes de lançar em {unidades.find((u) => u.id === unidadeSelecionada)?.nome}</span>
          </div>
          <b className="nf-total">{brl(totalNota)}</b>
        </div>

        <div className="nf-itens">
          {itens.map((item) => (
            <div key={item.id_temp} className="nf-item">
              <div className="nf-linha">
                <input className="inp" value={item.nome} onChange={(e) => mudar(item.id_temp, 'nome', e.target.value)} aria-label="Nome do insumo" />
                <button type="button" className="bt bt-ic bt-perigo" onClick={() => remover(item.id_temp)} aria-label={`Remover ${item.nome}`}>
                  <IcoLixo size={17} />
                </button>
              </div>
              <div className="nf-linha">
                <label className="nf-mini">
                  <span>Qtd</span>
                  <input className="inp" inputMode="decimal" value={item.quantidade} onChange={(e) => mudar(item.id_temp, 'quantidade', e.target.value)} />
                </label>
                <label className="nf-mini">
                  <span>Medida</span>
                  <select className="inp" value={item.unidade_medida} onChange={(e) => mudar(item.id_temp, 'unidade_medida', e.target.value)}>
                    {(['un', 'kg', 'g', 'l', 'ml'] as Medida[]).map((m) => <option key={m} value={m}>{rotulo(m)}</option>)}
                  </select>
                </label>
                <label className="nf-mini">
                  <span>Total R$</span>
                  <input className="inp" inputMode="decimal" value={item.preco_total} onChange={(e) => mudar(item.id_temp, 'preco_total', e.target.value)} />
                </label>
              </div>
              <NotaDestino {...destino(item)} />
            </div>
          ))}
        </div>

        <div className="nf-acoes">
          <button type="button" className="bt bt-sec" onClick={() => { setItens([]); setArquivo(null); }} disabled={salvando}>Descartar</button>
          <button type="button" className="bt bt-prim" onClick={salvarNoBanco} disabled={salvando} style={{ flex: 1 }}>
            {salvando ? 'Lançando no estoque…' : `Lançar ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}`}
          </button>
        </div>
      </div>
    );
  }

  // ---------- etapa 1: enviar a nota ----------
  return (
    <form onSubmit={extrairDados}>
      <div className="field">
        <label htmlFor="nf-unidade">Lançar no estoque de</label>
        <select id="nf-unidade" value={unidadeSelecionada} onChange={(e) => setUnidadeSelecionada(e.target.value)}>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Nota fiscal ou cupom</label>
        <div className="nf-envio">
          <label className="nf-botao">
            <IcoCamera size={22} />
            Tirar foto
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setArquivo(e.target.files?.[0] || null)} hidden />
          </label>
          <label className="nf-botao">
            <IcoArquivo size={22} />
            Escolher arquivo
            <input type="file" accept="image/*,.pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} hidden />
          </label>
        </div>
        {arquivo
          ? <p className="nf-arquivo"><IcoNota size={15} /> {arquivo.name === 'image.jpg' ? 'Foto da câmera' : arquivo.name}</p>
          : <p className="dica">Foto nítida, com a lista de itens inteira. Também aceita PDF.</p>}
      </div>

      <button type="submit" className="btn prim" disabled={lendo || !arquivo}>
        {lendo ? 'Lendo a nota com IA…' : 'Ler itens da nota'}
      </button>
    </form>
  );
}
