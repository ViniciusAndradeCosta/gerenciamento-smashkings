import BrandRow from './BrandRow';
import { brlPartes } from '@/lib/format';
import { IcoSubiu, IcoCaiu } from './Icons';

export default function Hero({
  saudacao, faturamento, ontem, itens,
}: {
  saudacao: string; faturamento: number; ontem: number; itens: number;
}) {
  const { inteiro, centavos } = brlPartes(faturamento);
  const variou = ontem > 0;
  const delta = variou ? ((faturamento - ontem) / ontem) * 100 : 0;
  const subiu = delta >= 0;

  return (
    <header className="hero">
      <BrandRow sub={saudacao} />
      <div className="hcap">Faturamento de hoje</div>
      <div className="hval">
        <em>R$</em>{inteiro}<small>,{centavos}</small>
      </div>
      <div className="hmeta">
        {variou && (
          <span className={'hpill' + (subiu ? '' : ' down')}>
            {subiu ? <IcoSubiu size={12} /> : <IcoCaiu size={12} />}
            {Math.abs(Math.round(delta))}%
          </span>
        )}
        <span className="mt">
          {variou ? 'vs. ontem · ' : 'Sem vendas ontem · '}
          {itens} {itens === 1 ? 'item' : 'itens'}
        </span>
      </div>
    </header>
  );
}
