import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializa a SDK do Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// --- SISTEMA DE RETRY (TENTATIVAS) ---
async function gerarConteudoComRetry(model: any, prompt: string, imagePart: any, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const result = await model.generateContent([prompt, imagePart]);
      return result;
    } catch (error: any) {
      if (i === tentativas - 1) throw error; 
      
      // Se der o erro 503 antigo (High Demand), espera 2 segundos e tenta de novo
      if (error.message?.includes('503') || error.message?.includes('high demand') || error.message?.includes('overloaded')) {
        console.log(`[Tentativa ${i + 1}/${tentativas}] Gemini ocupado. Aguardando 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error; 
      }
    }
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada no servidor.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const instrucoesExtras = formData.get('instrucoes_extras') as string || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhuma imagem ou arquivo foi enviado.' }, { status: 400 });
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

    // Retornando para a versão que o seu projeto já aceita e reconhece
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest'
    });

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
    const result = await gerarConteudoComRetry(model, prompt, imagePart);
    let textoResult = result.response.text();

    // Faxina extra caso a IA desobedeça e mande formatação de texto em volta do JSON
    textoResult = textoResult.replace(/```json/gi, '').replace(/```/g, '').trim();

    const jsonExtraido = JSON.parse(textoResult);

    const dadosFormatados = jsonExtraido.map((item: any) => ({
      ...item,
      id_temp: Math.random().toString(36).substring(7)
    }));

    return NextResponse.json(dadosFormatados);

  } catch (error: any) {
    console.error('Erro na API extrair-nf:', error);
    return NextResponse.json({ error: 'Falha ao extrair dados da nota.', detalhe: error.message }, { status: 500 });
  }
}