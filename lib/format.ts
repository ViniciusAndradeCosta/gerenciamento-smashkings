export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
export const num = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0);
export const pct = (v: number) => `${num(v, 1)}%`;

/** Valor sem casas decimais — para os números grandes em Barlow Condensed. */
export const brlCurto = (v: number) =>
  `R$${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v || 0)}`;

/** Separa reais e centavos para o destaque do hero: R$ 3.482,50 */
export function brlPartes(v: number) {
  const [inteiro, centavos] = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(v || 0)
    .split(',');
  return { inteiro, centavos };
}
