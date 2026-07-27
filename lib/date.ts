// Datas sempre no fuso da operação (Brasil), nunca em UTC.
// `new Date().toISOString()` devolve UTC: depois das 21h o "hoje" já virou
// amanhã e o dashboard zeraria no horário de pico.
const TZ = 'America/Sao_Paulo';

const iso = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD de hoje no fuso da operação. */
export const hoje = () => iso.format(new Date());

/** YYYY-MM-DD de ontem no fuso da operação. */
export const ontem = () => iso.format(new Date(Date.now() - 86_400_000));

/** YYYY-MM-01 do mês corrente no fuso da operação. */
export const inicioDoMes = () => `${hoje().slice(0, 8)}01`;

/** "Bom dia" / "Boa tarde" / "Boa noite" pela hora local. */
export function saudacao() {
  const h = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date())
  );
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
