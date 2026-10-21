/**
 * Medidas dos insumos.
 *
 * Cada insumo guarda estoque, compras e receitas numa medida BASE só
 * (normalmente kg, L ou un). Na tela, a pessoa digita na medida que for mais
 * prática (g ou kg, ml ou L) e aqui convertemos para a base antes de salvar.
 */

export type Medida = 'kg' | 'g' | 'l' | 'ml' | 'un';
type Familia = 'massa' | 'volume' | 'contagem';

const INFO: Record<Medida, { familia: Familia; fator: number; rotulo: string }> = {
  kg: { familia: 'massa', fator: 1000, rotulo: 'kg' },
  g: { familia: 'massa', fator: 1, rotulo: 'g' },
  l: { familia: 'volume', fator: 1000, rotulo: 'L' },
  ml: { familia: 'volume', fator: 1, rotulo: 'ml' },
  un: { familia: 'contagem', fator: 1, rotulo: 'un' },
};

const APELIDOS: Record<string, Medida> = {
  kg: 'kg', kgs: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gr: 'g', grs: 'g', grama: 'g', gramas: 'g',
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  ml: 'ml', mls: 'ml',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', u: 'un', pc: 'un', pç: 'un', peca: 'un', peça: 'un',
};

/** Medidas que dá para escolher como base de um insumo novo. */
export const BASES: { medida: Medida; nome: string }[] = [
  { medida: 'kg', nome: 'Peso (kg)' },
  { medida: 'l', nome: 'Líquido (L)' },
  { medida: 'un', nome: 'Unidade (un)' },
];

/** "KG", "Kg", "kilo" → "kg". Medida desconhecida é tratada como unidade. */
export function normalizar(m?: string | null): Medida {
  return APELIDOS[String(m || '').trim().toLowerCase()] || 'un';
}

/** Medida fora do padrão (ex.: "cx"): tratada como unidade, mas mostrada como foi cadastrada. */
const foraDoPadrao = (m?: string | null) => !!String(m || '').trim() && !APELIDOS[String(m).trim().toLowerCase()];

export const rotulo = (m?: string | null) => (foraDoPadrao(m) ? String(m).trim().toLowerCase() : INFO[normalizar(m)].rotulo);
const familia = (m?: string | null) => INFO[normalizar(m)].familia;

/** Medidas em que dá para digitar a quantidade de um insumo desta base. */
export function compativeis(base?: string | null): Medida[] {
  const f = familia(base);
  return (Object.keys(INFO) as Medida[]).filter((m) => INFO[m].familia === f);
}

export const mesmaFamilia = (a?: string | null, b?: string | null) => familia(a) === familia(b);

/** Converte valor de uma medida para outra (ex.: 500 g → 0,5 kg). NaN se não forem compatíveis. */
export function converter(valor: number, de?: string | null, para?: string | null): number {
  const a = INFO[normalizar(de)];
  const b = INFO[normalizar(para)];
  if (a.familia !== b.familia) return NaN;
  return (valor * a.fator) / b.fator;
}

/** Preço por "de" → preço por "para" (ex.: R$ 0,0385/g → R$ 38,50/kg). */
export function converterPreco(preco: number, de?: string | null, para?: string | null): number {
  const a = INFO[normalizar(de)];
  const b = INFO[normalizar(para)];
  if (a.familia !== b.familia) return NaN;
  return (preco * b.fator) / a.fator;
}

/** Medida mais legível para mostrar/editar um valor: 0,85 kg → g; 2 kg → kg. */
export function preferida(valor: number, base?: string | null): Medida {
  const m = normalizar(base);
  const { familia: f, fator } = INFO[m];
  const pequeno = Math.abs(valor * fator) < 1000;
  if (f === 'massa') return pequeno ? 'g' : 'kg';
  if (f === 'volume') return pequeno ? 'ml' : 'l';
  return m;
}

const nf = (v: number, casas: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(v || 0);
const casasDe = (m: Medida) => (m === 'kg' || m === 'l' ? 3 : m === 'g' || m === 'ml' ? 1 : 3);

/** Número e medida separados, já no formato mais legível ("850" e "g"). */
export function qtdPartes(valor: number, base?: string | null) {
  if (foraDoPadrao(base)) return { numero: nf(valor, 3), medida: rotulo(base) };
  const m = preferida(valor, base);
  return { numero: nf(converter(valor, base, m), casasDe(m)), medida: rotulo(m) };
}

/** Quantidade pronta para mostrar: 0,85 kg → "850 g"; 2,5 kg → "2,5 kg"; 14 un → "14 un". */
export function fmtQtd(valor: number, base?: string | null) {
  const { numero, medida } = qtdPartes(valor, base);
  return `${numero} ${medida}`;
}

/** Valor para preencher um campo, na medida escolhida e sem separador de milhar. */
export function textoEm(valor: number, base: string | null | undefined, medida: Medida) {
  const v = converter(valor, base, medida);
  return isFinite(v) ? nf(v, casasDe(medida)).replace(/\./g, '') : '';
}

/** Texto + medida de um campo de quantidade (o que o QtdInput edita). */
export type CampoQtd = { texto: string; medida: Medida };

/** Campo já preenchido na medida mais legível (0,85 kg → "850" g). */
export function campoQtd(valor: number, base?: string | null): CampoQtd {
  const medida = preferida(valor, base);
  return { texto: valor ? textoEm(valor, base, medida) : '0', medida };
}

/** Campo vazio, na medida mais prática para porções (g, ml ou un). */
export const campoVazio = (base?: string | null): CampoQtd => ({ texto: '', medida: preferida(0, base) });

/** Lê um campo para a base do insumo. Vazio vale `vazio` (padrão NaN). */
export const lerCampo = (c: CampoQtd | undefined, base?: string | null, vazio = NaN) =>
  c && c.texto.trim() ? lerQtd(c.texto, c.medida, base) : vazio;

/** Custo por medida legível: base em g ou ml vira preço por kg ou L. */
export function custoPartes(custo: number, base?: string | null) {
  if (foraDoPadrao(base)) return { preco: custo || 0, medida: rotulo(base) };
  const m = normalizar(base);
  const alvo: Medida = INFO[m].familia === 'massa' ? 'kg' : INFO[m].familia === 'volume' ? 'l' : m;
  return { preco: converterPreco(custo, m, alvo) || 0, medida: rotulo(alvo) };
}

/** "R$ 38,50 / kg" */
export function custoPor(custo: number, base?: string | null) {
  const { preco, medida } = custoPartes(custo, base);
  return `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco)} / ${medida}`;
}

/** Texto digitado ("1,5") na medida escolhida → valor na base do insumo. NaN se inválido. */
export function lerQtd(texto: string, medida: string, base?: string | null): number {
  const n = lerNumero(texto);
  return isNaN(n) ? NaN : converter(n, medida, base);
}

/**
 * "1,5", "1.5" e "1.234,5" → número. Teclados de celular às vezes só têm
 * ponto, então o ponto só é separador de milhar quando também há vírgula.
 */
export function lerNumero(texto: string): number {
  const s = String(texto || '').trim();
  if (!s) return NaN;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}
