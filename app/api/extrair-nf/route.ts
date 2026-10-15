import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

// Leitura de imagem pelo Gemini (com as tentativas) pode passar dos 10s
// padrão da Vercel.
export const maxDuration = 60;

// Mesmos modelos do chat; o principal pode ser trocado via GEMINI_MODEL. O
// flash-lite é a reserva para quando o Google responde 503 ("high demand").
const MODELOS = Array.from(new Set([process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest']));

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const TAMANHO_MAX = 4 * 1024 * 1024; // a Vercel recusa corpos acima de ~4,5 MB

// --- SISTEMA DE RETRY (TENTATIVAS) ---
// Em cada modelo: tenta 2x se o Gemini estiver ocupado; depois passa para o reserva.
async function gerarConteudoComRetry(genAI: GoogleGenerativeAI, prompt: string, imagePart: any) {
  let ultimoErro: any;
  for (const nome of MODELOS) {
    const model = genAI.getGenerativeModel({ model: nome });
    for (let i = 1; i <= 2; i++) {
      try {
        return await model.generateContent([prompt, imagePart]);
      } catch (error: any) {
        ultimoErro = error;
        const ocupado = /503|429|500|high demand|overloaded|unavailable/i.test(error.message || '');
        console.log(`[${nome} tentativa ${i}/2] ${ocupado ? 'Gemini ocupado' : 'erro'}: ${error.message?.slice(0, 150)}`);
        if (!ocupado) break;
        if (i === 1) await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  throw ultimoErro;
}

export async function POST(req: Request) {
  try {
    // Só usuários logados (a chave do Gemini é paga por uso/cota)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada no servidor.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const instrucoesExtras = String(formData.get('instrucoes_extras') || '').slice(0, 2000);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhuma imagem ou arquivo foi enviado.' }, { status: 400 });
    }
    if (!TIPOS_ACEITOS.includes(file.type)) {
      return NextResponse.json({ error: 'Formato não suportado. Envie uma foto (JPG/PNG) ou PDF.' }, { status: 400 });
    }
    if (file.size > TAMANHO_MAX) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 4 MB).' }, { status: 413 });
    }

    // Prepara a imagem para a IA
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imagePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: file.type
      }
    };

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Monta a regra incluindo a blindagem de marcas e pesos
    const prompt = `
      Você é um assistente de extração de dados de notas fiscais de supermercado/fornecedores.
      Analise a imagem da nota fiscal ou cupom fiscal anexada.

      Extraia os produtos comprados e retorne APENAS um array JSON puro, onde cada objeto tem o seguinte formato exato:
      [
        {
          "nome": "Nome do produto",
          "quantidade": 1.5,
          "unidade_medida": "KG",
          "preco_total": 15.90
        }
      ]

      INSTRUÇÕES IMPORTANTES:
      - NUNCA retorne blocos de formatação markdown (como \`\`\`json). Devolva apenas o JSON limpo.
      - A quantidade deve ser um número (float).
      - O preco_total deve ser o valor total do item numérico (float).
      - unidade_medida deve ser preferencialmente UN, KG, L, G, ML.

      ${instrucoesExtras}
    `;

    // Chama a IA protegida pelo sistema de tentativas
    const result = await gerarConteudoComRetry(genAI, prompt, imagePart);
    const textoResult: string = result.response.text();

    // Faxina caso a IA desobedeça e mande texto/markdown em volta do JSON
    const inicio = textoResult.indexOf('[');
    const fim = textoResult.lastIndexOf(']');
    if (inicio === -1 || fim < inicio) {
      return NextResponse.json({ error: 'Não consegui identificar itens nessa imagem. Tente uma foto mais nítida.' }, { status: 422 });
    }

    const jsonExtraido = JSON.parse(textoResult.slice(inicio, fim + 1));
    if (!Array.isArray(jsonExtraido)) {
      return NextResponse.json({ error: 'A leitura da nota veio num formato inesperado. Tente de novo.' }, { status: 422 });
    }

    const paraNumero = (v: unknown) => Number(String(v ?? '').replace(',', '.'));
    const dadosFormatados = jsonExtraido
      .filter((item: any) => item && typeof item.nome === 'string' && item.nome.trim())
      .map((item: any) => ({
        nome: item.nome.trim(),
        quantidade: paraNumero(item.quantidade) || 0,
        unidade_medida: String(item.unidade_medida || 'UN').toUpperCase(),
        preco_total: paraNumero(item.preco_total) || 0,
        id_temp: Math.random().toString(36).substring(7)
      }));

    return NextResponse.json(dadosFormatados);

  } catch (error: any) {
    console.error('Erro na API extrair-nf:', error);
    return NextResponse.json({ error: 'Falha ao extrair dados da nota. Tente de novo em instantes.' }, { status: 500 });
  }
}
