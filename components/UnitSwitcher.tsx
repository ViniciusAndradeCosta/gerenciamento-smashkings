'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Unidade } from '@/lib/types';

/**
 * Chips de unidade. Lê as unidades do banco (nada fica fixo no código)
 * e preserva os demais parâmetros da URL ao trocar.
 */
export default function UnitSwitcher({ unidades }: { unidades: Unidade[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const atual = params.get('u') || 'all';

  function ir(codigo: string) {
    const p = new URLSearchParams(params.toString());
    if (codigo === 'all') p.delete('u');
    else p.set('u', codigo);
    const qs = p.toString();
    router.push(qs ? `${path}?${qs}` : path);
  }

  if (unidades.length < 2) return null;

  return (
    <div className="useg" role="group" aria-label="Filtrar por unidade">
      <button className={atual === 'all' ? 'act' : ''} aria-pressed={atual === 'all'} onClick={() => ir('all')}>
        Todas
      </button>
      {unidades.map((un) => (
        <button
          key={un.id}
          className={atual === un.codigo ? 'act' : ''}
          aria-pressed={atual === un.codigo}
          onClick={() => ir(un.codigo)}
        >
          <span className="ud" style={{ background: un.cor }} />
          {un.nome}
        </button>
      ))}
    </div>
  );
}
