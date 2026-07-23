'use client';
import { usePathname, useRouter } from 'next/navigation';

const items = [
  { href: '/', icon: '🏠', label: 'Início' },
  { href: '/estoque', icon: '📦', label: 'Estoque' },
  { href: '/compras', icon: '', label: '', fab: true },
  { href: '/cmv', icon: '📈', label: 'CMV' },
  { href: '/fichas', icon: '📋', label: 'Fichas' },
];

export default function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  if (path === '/login') return null;
  return (
    <nav className="nav">
      {items.map((it) =>
        it.fab ? (
          <div key={it.href} className="nb nb-fab" onClick={() => router.push(it.href)}>
            <span className="plus">+</span>
          </div>
        ) : (
          <div
            key={it.href}
            className={'nb' + (path === it.href ? ' act' : '')}
            onClick={() => router.push(it.href)}
          >
            <span className="ni">{it.icon}</span>
            {it.label}
          </div>
        )
      )}
    </nav>
  );
}
