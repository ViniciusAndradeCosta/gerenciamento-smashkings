'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function UnitSwitcher() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const cur = params.get('u') || 'all';
  const go = (u: string) => router.push(`${path}?u=${u}`);
  const opt = (u: string, cor: string, label: string) => (
    <a className={cur === u ? 'act' : ''} onClick={() => go(u)}>
      <span className="ud" style={{ background: cor }} />
      {label}
    </a>
  );
  return (
    <div className="useg">
      {opt('all', 'var(--red)', 'Todas')}
      {opt('U1', 'var(--blue)', 'Centro')}
      {opt('U2', 'var(--green)', 'Norte')}
    </div>
  );
}
