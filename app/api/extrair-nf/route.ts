import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    // 1. Verificação de segurança da chave
    if (!process.env.GEMINI_API_KEY) {
      console.error("ERRO GRAVE: A chave GEMINI_API_KEY não foi encontrada pelo Next.js!");
      return NextResponse.json({ error: 'Chave da API ausente no servidor.' }, { status: 500 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo recebido' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    console.log("Arquivo recebido com sucesso. Chamando API do Google...");

    // 2. Chamada à API com o modelo oficial e estável
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `
      Você é um assistente de gestão de restaurante. 
      Analise a imagem desta nota fiscal anexada.
      Extraia os produtos comprados e retorne EXATAMENTE UM ARRAY JSON válido. 
      Não escreva nenhuma introdução, não use formatação markdown, apenas o array puro.

      INSTRUÇÃO IMPORTANTE SOBRE OS NOMES:
      Os nomes dos produtos nas notas fiscais costumam vir com siglas de fornecedores, códigos numéricos, marcas desnecessárias e informações de peso/embalagem no meio do texto.
      Sua missão é LIMPAR o nome, mantendo apenas a essência do ingrediente formatado em "Title Case" (Primeiras Letras Maiúsculas) com acentuação correta.
      
      Exemplos de como limpar:
      - "OLEO SOJA VELEIRO 900ML CJ6" -> "Óleo de Soja Veleiro"
      - "FLV CEBOLA AMARELA kg" -> "Cebola Amarela"
      - "FLV ALHO kg" -> "Alho"
      - "ACUCAR MASCAVO VITAPAO 2kg" -> "Açúcar Mascavo Vitapão"
      - "CX. TOMATE LONGA VIDA 20KG" -> "Tomate Longa Vida"
      
      Formato exigido para cada objeto do array:
      - "id_temp": uma string única para cada item (ex: "1", "2")
      - "nome": string com o nome do produto JÁ LIMPO e padronizado
      - "quantidade": numero (quantidade comprada ou peso bruto)
      - "unidade_medida": string (apenas a sigla limpa: "UN", "KG", "L", "PCT", "CX")
      - "preco_total": numero (o preço TOTAL daquele item na nota)
    `;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();
    
    console.log("Resposta recebida da IA!");

    // Limpeza da formatação para garantir que o JSON funcione
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonDaIA = JSON.parse(text);

    return NextResponse.json(jsonDaIA);

  } catch (error: any) {
    console.error('=== ERRO DETALHADO NA API ===');
    console.error(error);
    return NextResponse.json(
      { error: 'Erro ao processar a nota fiscal com a IA.', detalhe: error.message }, 
      { status: 500 }
    );
  }
}