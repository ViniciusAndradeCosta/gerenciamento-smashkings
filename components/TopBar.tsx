import { Suspense } from 'react';
import BrandRow from './BrandRow';
import UnitSwitcher from './UnitSwitcher';
import type { Unidade } from '@/lib/types';

/** Topo das telas internas. Passe `unidades` só onde o filtro faz sentido. */
export default function TopBar({ titulo, unidades }: { titulo: string; unidades?: Unidade[] }) {
  return (
    <header className="tbar">
      <div className="wrap">
        <BrandRow sub={titulo} />
      </div>
      {unidades && unidades.length > 0 && (
        <Suspense fallback={<div className="useg" />}>
          <UnitSwitcher unidades={unidades} />
        </Suspense>
      )}
    </header>
  );
}
