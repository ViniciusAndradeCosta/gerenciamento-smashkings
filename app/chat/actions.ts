'use server';

import { createClient } from '@/lib/supabase/server';
import { brl, num, pct } from '@/lib/format';
import { hoje, ontem, inicioDoMes } from '@/lib/date';

/** Quantidade sem zeros sobrando: 14 un, 0,42 kg. */
const qtd = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v || 0);

export type Mensagem = { autor: 'user' | 'assistant'; texto: string };
export type Resposta =
  | { ok: true; resposta: string; modo: 'ia' }
  | { ok: true; resposta: string; modo: 'local'; motivo: 'sem_chave' | 'ia_indisponivel' }
  | { ok: false; erro: string };

// gemini-flash-latest sempre aponta pro flash atual do Google — não quebra
// quando uma versão é aposentada. Pode trocar via GEMINI_MODEL no ambiente.
// O flash-lite é a reserva: o Google às vezes devolve 503 ("high demand")
// no modelo principal.
const MODELOS = Array.from(new Set([process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest']));

type Resumo = {
  unidades: { nome: string }[];
  faturamentoHoje: number;
  itensHoje: number;
  faturamentoOntem: number;
  faturamentoMes: number;
  custoMes: number;
  cmvPct: number;
  comprasMes: number;
  valorEstoque: number;
  alertas: { ingrediente: string; quantidade: number; minimo: number; medida: string; status: string; unidade: string }[];
  porUnidade: { nome: string; faturamento: number; estoque: number; alertas: number }[];
  /** quantidade atual de cada insumo em cada unidade ("quantos pães tem na Bela Vista?") */
  estoqueItens: { ingrediente: string; medida: string; unidade: string; quantidade: number }[];
};

/** Junta os números do negócio a partir do Supabase (respeita o RLS do usuário). */
async function montarResumo(): Promise<Resumo> {
  const supabase = await createClient();
  const hj = hoje();
  const ont = ontem();
  const desde = inicioDoMes();

  const [
    { data: unidades },
    { data: vHoje },
    { data: vOntem },
    { data: vMes },
    { data: custos },
    { data: valorEst },
    { data: alertas },
    { data: compras },
    { data: estoque },
  ] = await Promise.all([
    supabase.from('unidades').select('nome, id').order('codigo'),
    supabase.from('vendas').select('valor_total, quantidade, unidade_id').eq('data_venda', hj),
    supabase.from('vendas').select('valor_total').eq('data_venda', ont),
    supabase.from('vendas').select('produto_id, quantidade, valor_total, unidade_id').gte('data_venda', desde),
    supabase.from('v_custo_produto').select('produto_id, custo_total'),
    supabase.from('v_valor_estoque').select('*'),
    supabase.from('v_alertas_estoque').select('*').neq('status', 'ok'),
    supabase.from('compras').select('total').gte('data_compra', desde),
    supabase.from('estoque').select('quantidade, ingredientes(nome, unidade_medida, ativo), unidades(nome)').limit(1000),
  ]);

  const soma = (arr: any[] | null, campo: string) =>
    (arr || []).reduce((s: number, x: any) => s + Number(x[campo] || 0), 0);

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));
  const faturamentoMes = soma(vMes, 'valor_total');
  const custoMes = (vMes || []).reduce(
    (s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade),
    0
  );

  // v_valor_estoque já vem uma linha por unidade — guardamos o valor de cada loja
  // para responder "estoque da Bela Vista" sem misturar com a outra unidade.
  const estoqueDe = new Map((valorEst || []).map((v: any) => [v.unidade_id, Number(v.valor_total)]));

  return {
    unidades: (unidades || []).map((u: any) => ({ nome: u.nome })),
    faturamentoHoje: soma(vHoje, 'valor_total'),
    itensHoje: soma(vHoje, 'quantidade'),
    faturamentoOntem: soma(vOntem, 'valor_total'),
    faturamentoMes,
    custoMes,
    cmvPct: faturamentoMes ? (custoMes / faturamentoMes) * 100 : 0,
    comprasMes: soma(compras, 'total'),
    valorEstoque: soma(valorEst, 'valor_total'),
    alertas: (alertas || []).map((a: any) => ({
      ingrediente: a.ingrediente,
      quantidade: Number(a.quantidade),
      minimo: Number(a.estoque_minimo),
      medida: a.unidade_medida,
      status: a.status,
      unidade: a.unidade_nome,
    })),
    porUnidade: (unidades || []).map((un: any) => ({
      nome: un.nome,
      faturamento: (vMes || [])
        .filter((v: any) => v.unidade_id === un.id)
        .reduce((s: number, x: any) => s + Number(x.valor_total), 0),
      estoque: estoqueDe.get(un.id) || 0,
      alertas: (alertas || []).filter((a: any) => a.unidade_id === un.id).length,
    })),
    estoqueItens: (estoque || [])
      .filter((e: any) => e.ingredientes && e.unidades && e.ingredientes.ativo !== false)
      .map((e: any) => ({
        ingrediente: e.ingredientes.nome,
        medida: e.ingredientes.unidade_medida,
        unidade: e.unidades.nome,
        quantidade: Number(e.quantidade),
      }))
      .sort((a: any, b: any) => a.ingrediente.localeCompare(b.ingrediente, 'pt-BR')),
  };
}

/** Agrupa o estoque por insumo: "Pão Brioche: Bela Vista 14 un; João Monlevade 8 un". */
function estoquePorInsumo(itens: Resumo['estoqueItens']) {
  const grupos = new Map<string, Resumo['estoqueItens']>();
  for (const i of itens) grupos.set(i.ingrediente, [...(grupos.get(i.ingrediente) || []), i]);
  return grupos;
}

/** Texto compacto com os dados, usado como referência para o modelo. */
function resumoTexto(r: Resumo): string {
  const alertas = r.alertas.length
    ? r.alertas
        .map((a) => `  - ${a.ingrediente} (${a.unidade}): ${num(a.quantidade, 2)} ${a.medida}, mínimo ${num(a.minimo, 2)} — ${a.status}`)
        .join('\n')
    : '  (nenhum item abaixo do mínimo)';
  const unidades = r.porUnidade
    .map(
      (u) =>
        `  - ${u.nome}: faturamento ${brl(u.faturamento)} no mês, valor em estoque ${brl(u.estoque)}, ${u.alertas} ${u.alertas === 1 ? 'item' : 'itens'} em alerta`
    )
    .join('\n');
  const insumos = Array.from(estoquePorInsumo(r.estoqueItens))
    .slice(0, 300)
    .map(([nome, itens]) => `  - ${nome}: ${itens.map((i) => `${i.unidade} ${qtd(i.quantidade)} ${i.medida}`).join('; ')}`)
    .join('\n') || '  (nenhum insumo em estoque)';

  return `DADOS ATUAIS DA SMASHKINGS (use apenas estes números):
- Unidades: ${r.unidades.map((u) => u.nome).join(', ') || '—'}
- Faturamento hoje: ${brl(r.faturamentoHoje)} (${num(r.itensHoje)} itens vendidos)
- Faturamento ontem: ${brl(r.faturamentoOntem)}
- Faturamento no mês: ${brl(r.faturamentoMes)}
- CMV do mês: ${pct(r.cmvPct)} (custo dos produtos vendidos: ${brl(r.custoMes)}) — meta saudável 28% a 35%
- Compras no mês: ${brl(r.comprasMes)}
- Valor total em estoque (todas as unidades somadas): ${brl(r.valorEstoque)}
- Itens em alerta de estoque:
${alertas}
- Dados separados de cada unidade (mês):
${unidades}
- Estoque por insumo (quantidade atual em cada unidade):
${insumos}`;
}

const SISTEMA = `Você é o assistente da SmashKings, uma hamburgueria com duas unidades. Responda em português do Brasil, de forma curta, clara e direta, como um gerente falaria.

Regras:
- Responda SOMENTE com base nos dados fornecidos na mensagem. Nunca invente números.
- Se a pergunta pedir algo que não está nos dados, diga que ainda não tem essa informação e sugira o que dá pra perguntar (vendas, CMV, estoque, compras, comparativo entre unidades).
- Quando perguntarem quanto tem de um insumo (ex.: "quantos pães"), responda com a QUANTIDADE e a medida da lista "Estoque por insumo", não com o valor em reais.
- Valores em dinheiro sempre em reais (R$). Seja objetivo; use no máximo alguns tópicos curtos quando fizer sentido.`;

/** Erro do Gemini que pode passar se tentar de novo (sobrecarga, limite, rede). */
class ErroGemini extends Error {
  constructor(mensagem: string, public temporario: boolean) {
    super(mensagem);
  }
}

async function chamarGemini(modelo: string, resumo: string, historico: Mensagem[], pergunta: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

  const contents = [
    ...historico.slice(-8).map((m) => ({
      role: m.autor === 'user' ? 'user' : 'model',
      parts: [{ text: m.texto }],
    })),
    { role: 'user', parts: [{ text: `${resumo}\n\nPergunta do gerente: ${pergunta}` }] },
  ];

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      // chave no cabeçalho (não na URL, onde apareceria em logs)
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents,
        // Modelos "flash" recentes pensam antes de responder; o limite precisa
        // caber o raciocínio + a resposta, senão a resposta pode vir vazia.
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e: any) {
    throw new ErroGemini(`Gemini (${modelo}) sem resposta: ${e?.message}`, true);
  }

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '');
    throw new ErroGemini(`Gemini (${modelo}) ${resp.status}: ${detalhe.slice(0, 200)}`, [429, 500, 503].includes(resp.status));
  }

  const data = await resp.json();
  const texto = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || '')
    .join('')
    .trim();
  if (!texto) throw new ErroGemini(`Gemini (${modelo}) não retornou texto.`, true);
  return texto;
}

/** Tenta o modelo principal (2x se for erro passageiro) e depois o reserva. */
async function chamarGeminiComReserva(resumo: string, historico: Mensagem[], pergunta: string): Promise<string> {
  let ultimoErro: unknown;
  for (const modelo of MODELOS) {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        return await chamarGemini(modelo, resumo, historico, pergunta);
      } catch (e) {
        ultimoErro = e;
        console.error('[chat]', e instanceof Error ? e.message : e);
        if (!(e instanceof ErroGemini && e.temporario)) break;
        if (tentativa === 1) await new Promise((ok) => setTimeout(ok, 1200));
      }
    }
  }
  throw ultimoErro;
}

/** Sem acento e em minúsculas, para comparar texto digitado com os cadastros. */
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Palavras "de verdade" (3+ letras) já no singular: "pães" e "pão" viram "pao". */
function palavras(s: string) {
  return semAcento(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .map((w) => (/(oes|aes)$/.test(w) ? w.slice(0, -3) + 'ao' : w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** Modo local (sem chave): responde as perguntas mais comuns direto dos dados. */
function respostaLocal(pergunta: string, r: Resumo): string {
  const p = semAcento(pergunta);
  const tem = (...ts: string[]) => ts.some((t) => p.includes(t));

  // Detecta se a pergunta cita uma unidade específica (ex.: "estoque da bela vista").
  const unidadeCitada = r.porUnidade.find((u) => {
    const nomes = semAcento(u.nome).replace(/unidade\s*/g, '').split(/\s+/).filter((w) => w.length >= 4);
    return nomes.some((w) => p.includes(w));
  });

  if (tem('cmv')) {
    const situacao = r.cmvPct === 0 ? 'ainda sem vendas no mês' : r.cmvPct <= 35 ? 'dentro da meta (28% a 35%)' : 'acima da meta de 35%';
    return `O CMV do mês está em ${pct(r.cmvPct)} — ${situacao}. No mês, ${brl(r.faturamentoMes)} vendidos custaram ${brl(r.custoMes)} em insumos.`;
  }

  // Pergunta sobre um insumo ("quantos pães tem na bela vista?"): responde a
  // quantidade. Escolhe o(s) insumo(s) com mais palavras em comum com a pergunta.
  const termos = new Set(palavras(pergunta));
  const grupos = estoquePorInsumo(r.estoqueItens);
  let melhor = 0;
  let citados: string[] = [];
  for (const nome of Array.from(grupos.keys())) {
    const pontos = palavras(nome).filter((w) => termos.has(w)).length;
    if (pontos > melhor) { melhor = pontos; citados = [nome]; }
    else if (pontos > 0 && pontos === melhor) citados.push(nome);
  }
  if (citados.length && !tem('compra', 'comprei', 'gastei')) {
    const linhas = citados.slice(0, 6).map((nome) => {
      const itens = grupos.get(nome)!.filter((i) => !unidadeCitada || i.unidade === unidadeCitada.nome);
      if (!itens.length) return `• ${nome}: sem estoque registrado na ${unidadeCitada!.nome}`;
      const medida = itens[0].medida;
      if (itens.length === 1) return `• ${nome}: ${qtd(itens[0].quantidade)} ${medida} na ${itens[0].unidade}`;
      const total = itens.reduce((s, i) => s + i.quantidade, 0);
      return `• ${nome}: ${itens.map((i) => `${i.unidade} ${qtd(i.quantidade)} ${medida}`).join(' · ')} (total ${qtd(total)} ${medida})`;
    });
    return `Estoque atual:\n${linhas.join('\n')}`;
  }
  if (tem('acaband', 'alerta', 'falta', 'minimo', 'mínimo', 'estoque baixo', 'repor', 'comprar')) {
    if (!r.alertas.length) return 'Nenhum item está abaixo do estoque mínimo. Tudo certo por aqui. ✅';
    const lista = r.alertas
      .slice(0, 8)
      .map((a) => `• ${a.ingrediente} (${a.unidade}): ${num(a.quantidade, 2)} ${a.medida} — mínimo ${num(a.minimo, 2)}`)
      .join('\n');
    return `Itens em alerta de estoque:\n${lista}`;
  }
  if (tem('estoque')) {
    if (unidadeCitada) {
      return `O valor em estoque da ${unidadeCitada.nome} é ${brl(unidadeCitada.estoque)}, com ${unidadeCitada.alertas} ${unidadeCitada.alertas === 1 ? 'item' : 'itens'} em alerta.`;
    }
    const porU = r.porUnidade.map((u) => `• ${u.nome}: ${brl(u.estoque)}`).join('\n');
    return `Valor total em estoque: ${brl(r.valorEstoque)} (${r.alertas.length} em alerta no total).\nPor unidade:\n${porU}`;
  }
  if (tem('compra')) {
    return `As compras registradas no mês somam ${brl(r.comprasMes)}.`;
  }
  if (tem('compar', 'unidade', 'melhor', 'centro', 'norte')) {
    if (unidadeCitada) {
      return `${unidadeCitada.nome} no mês: faturamento ${brl(unidadeCitada.faturamento)}, valor em estoque ${brl(unidadeCitada.estoque)}, ${unidadeCitada.alertas} ${unidadeCitada.alertas === 1 ? 'item' : 'itens'} em alerta.`;
    }
    const lista = r.porUnidade
      .map((u) => `• ${u.nome}: faturamento ${brl(u.faturamento)}, estoque ${brl(u.estoque)}, ${u.alertas} em alerta`)
      .join('\n');
    return `Comparativo por unidade (mês):\n${lista}`;
  }
  if (tem('ontem')) {
    return `Ontem o faturamento foi ${brl(r.faturamentoOntem)}.`;
  }
  if (tem('mes', 'mês')) {
    return `No mês, o faturamento é ${brl(r.faturamentoMes)}, com CMV de ${pct(r.cmvPct)}.`;
  }
  if (tem('venda', 'faturamento', 'vendi', 'vend', 'hoje', 'fatur')) {
    const comp = r.faturamentoOntem
      ? ` (ontem foram ${brl(r.faturamentoOntem)})`
      : '';
    return `Hoje o faturamento é ${brl(r.faturamentoHoje)}, com ${num(r.itensHoje)} itens vendidos${comp}.`;
  }

  return `Posso te ajudar com os números da operação. Experimente perguntar sobre:
• Vendas de hoje ou do mês
• CMV do mês
• O que está acabando no estoque
• Compras do mês
• Comparativo entre as unidades

Resumo rápido: hoje ${brl(r.faturamentoHoje)} • mês ${brl(r.faturamentoMes)} • CMV ${pct(r.cmvPct)} • ${r.alertas.length} alertas de estoque.`;
}

/** Responde uma pergunta do gerente. Usa o Gemini se a chave existir; senão, modo local. */
export async function perguntar(pergunta: string, historico: Mensagem[] = []): Promise<Resposta> {
  const texto = (pergunta || '').trim().slice(0, 1000);
  if (!texto) return { ok: false, erro: 'Escreva uma pergunta.' };
  // A action é um endpoint público: limita o que vai para o Gemini
  historico = (Array.isArray(historico) ? historico : [])
    .slice(-8)
    .map((m) => ({ autor: m?.autor === 'user' ? 'user' : 'assistant', texto: String(m?.texto || '').slice(0, 2000) }));

  let resumo: Resumo;
  try {
    resumo = await montarResumo();
  } catch (e: any) {
    return { ok: false, erro: 'Não consegui ler os dados do sistema agora.' };
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const resposta = await chamarGeminiComReserva(resumoTexto(resumo), historico, texto);
      return { ok: true, resposta, modo: 'ia' };
    } catch {
      // Se a IA falhar (sobrecarga, cota, rede), não deixa o usuário na mão:
      // responde no modo local e avisa que foi uma falha passageira.
      return { ok: true, resposta: respostaLocal(texto, resumo), modo: 'local', motivo: 'ia_indisponivel' };
    }
  }

  return { ok: true, resposta: respostaLocal(texto, resumo), modo: 'local', motivo: 'sem_chave' };
}
