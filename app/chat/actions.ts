'use server';

import { createClient } from '@/lib/supabase/server';
import { brl, num, pct } from '@/lib/format';
import { hoje, ontem, inicioDoMes } from '@/lib/date';

export type Mensagem = { autor: 'user' | 'assistant'; texto: string };
export type Resposta =
  | { ok: true; resposta: string; modo: 'ia' | 'local' }
  | { ok: false; erro: string };

// gemini-flash-latest sempre aponta pro flash atual do Google — não quebra
// quando uma versão é aposentada. Pode trocar via GEMINI_MODEL no ambiente.
const MODELO = process.env.GEMINI_MODEL || 'gemini-flash-latest';

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
  porUnidade: { nome: string; faturamento: number }[];
};

/** Junta os números do negócio a partir do Supabase (respeita o RLS do usuário). */
async function montarResumo(): Promise<Resumo> {
  const supabase = createClient();
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
  ] = await Promise.all([
    supabase.from('unidades').select('nome, id').order('codigo'),
    supabase.from('vendas').select('valor_total, quantidade, unidade_id').eq('data_venda', hj),
    supabase.from('vendas').select('valor_total').eq('data_venda', ont),
    supabase.from('vendas').select('produto_id, quantidade, valor_total, unidade_id').gte('data_venda', desde),
    supabase.from('v_custo_produto').select('produto_id, custo_total'),
    supabase.from('v_valor_estoque').select('*'),
    supabase.from('v_alertas_estoque').select('*').neq('status', 'ok'),
    supabase.from('compras').select('total').gte('data_compra', desde),
  ]);

  const soma = (arr: any[] | null, campo: string) =>
    (arr || []).reduce((s: number, x: any) => s + Number(x[campo] || 0), 0);

  const custoDe = new Map((custos || []).map((c: any) => [c.produto_id, Number(c.custo_total)]));
  const faturamentoMes = soma(vMes, 'valor_total');
  const custoMes = (vMes || []).reduce(
    (s: number, x: any) => s + (custoDe.get(x.produto_id) || 0) * Number(x.quantidade),
    0
  );

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
    })),
  };
}

/** Texto compacto com os dados, usado como referência para o modelo. */
function resumoTexto(r: Resumo): string {
  const alertas = r.alertas.length
    ? r.alertas
        .map((a) => `  - ${a.ingrediente} (${a.unidade}): ${num(a.quantidade, 2)} ${a.medida}, mínimo ${num(a.minimo, 2)} — ${a.status}`)
        .join('\n')
    : '  (nenhum item abaixo do mínimo)';
  const unidades = r.porUnidade.map((u) => `  - ${u.nome}: ${brl(u.faturamento)} no mês`).join('\n');

  return `DADOS ATUAIS DA SMASHKINGS (use apenas estes números):
- Unidades: ${r.unidades.map((u) => u.nome).join(', ') || '—'}
- Faturamento hoje: ${brl(r.faturamentoHoje)} (${num(r.itensHoje)} itens vendidos)
- Faturamento ontem: ${brl(r.faturamentoOntem)}
- Faturamento no mês: ${brl(r.faturamentoMes)}
- CMV do mês: ${pct(r.cmvPct)} (custo dos produtos vendidos: ${brl(r.custoMes)}) — meta saudável 28% a 35%
- Compras no mês: ${brl(r.comprasMes)}
- Valor total em estoque: ${brl(r.valorEstoque)}
- Itens em alerta de estoque:
${alertas}
- Faturamento por unidade no mês:
${unidades}`;
}

const SISTEMA = `Você é o assistente da SmashKings, uma hamburgueria com duas unidades. Responda em português do Brasil, de forma curta, clara e direta, como um gerente falaria.

Regras:
- Responda SOMENTE com base nos dados fornecidos na mensagem. Nunca invente números.
- Se a pergunta pedir algo que não está nos dados, diga que ainda não tem essa informação e sugira o que dá pra perguntar (vendas, CMV, estoque, compras, comparativo entre unidades).
- Valores sempre em reais (R$). Seja objetivo; use no máximo alguns tópicos curtos quando fizer sentido.`;

async function chamarGemini(resumo: string, historico: Mensagem[], pergunta: string): Promise<string> {
  const chave = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`;

  const contents = [
    ...historico.slice(-8).map((m) => ({
      role: m.autor === 'user' ? 'user' : 'model',
      parts: [{ text: m.texto }],
    })),
    { role: 'user', parts: [{ text: `${resumo}\n\nPergunta do gerente: ${pergunta}` }] },
  ];

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEMA }] },
      contents,
      // Modelos "flash" recentes pensam antes de responder; o limite precisa
      // caber o raciocínio + a resposta, senão a resposta pode vir vazia.
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${detalhe.slice(0, 200)}`);
  }

  const data = await resp.json();
  const texto = (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || '')
    .join('')
    .trim();
  if (!texto) throw new Error('O assistente não retornou resposta.');
  return texto;
}

/** Modo local (sem chave): responde as perguntas mais comuns direto dos dados. */
function respostaLocal(pergunta: string, r: Resumo): string {
  const p = pergunta
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const tem = (...ts: string[]) => ts.some((t) => p.includes(t));

  if (tem('cmv')) {
    const situacao = r.cmvPct === 0 ? 'ainda sem vendas no mês' : r.cmvPct <= 35 ? 'dentro da meta (28% a 35%)' : 'acima da meta de 35%';
    return `O CMV do mês está em ${pct(r.cmvPct)} — ${situacao}. No mês, ${brl(r.faturamentoMes)} vendidos custaram ${brl(r.custoMes)} em insumos.`;
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
    return `O valor total em estoque é ${brl(r.valorEstoque)}. Itens em alerta: ${r.alertas.length}.`;
  }
  if (tem('compra')) {
    return `As compras registradas no mês somam ${brl(r.comprasMes)}.`;
  }
  if (tem('compar', 'unidade', 'melhor', 'centro', 'norte')) {
    const lista = r.porUnidade.map((u) => `• ${u.nome}: ${brl(u.faturamento)}`).join('\n');
    return `Faturamento por unidade no mês:\n${lista}`;
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
  const texto = (pergunta || '').trim();
  if (!texto) return { ok: false, erro: 'Escreva uma pergunta.' };

  let resumo: Resumo;
  try {
    resumo = await montarResumo();
  } catch (e: any) {
    return { ok: false, erro: 'Não consegui ler os dados do sistema agora.' };
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const resposta = await chamarGemini(resumoTexto(resumo), historico, texto);
      return { ok: true, resposta, modo: 'ia' };
    } catch {
      // Se a IA falhar (cota, rede), não deixa o usuário na mão: cai no modo local.
      return { ok: true, resposta: respostaLocal(texto, resumo), modo: 'local' };
    }
  }

  return { ok: true, resposta: respostaLocal(texto, resumo), modo: 'local' };
}
