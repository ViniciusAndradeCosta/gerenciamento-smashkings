'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  IcoInicio, IcoEstoque, IcoCmv, IcoFichas, IcoCompras,
  IcoComparativo, IcoMais, IcoSair,
} from './Icons';

type Item = { href: string; label: string; Ico: (p: { size?: number }) => JSX.Element };

// menu completo — aparece no lateral (desktop)
const todos: Item[] = [
  { href: '/', label: 'Início', Ico: IcoInicio },
  { href: '/estoque', label: 'Estoque', Ico: IcoEstoque },
  { href: '/compras', label: 'Compras', Ico: IcoCompras },
  { href: '/cmv', label: 'CMV', Ico: IcoCmv },
  { href: '/fichas', label: 'Fichas', Ico: IcoFichas },
  { href: '/comparativo', label: 'Comparativo', Ico: IcoComparativo },
];

// barra inferior (celular): Definida manualmente para podermos encurtar o nome e organizar a ordem
const barra: Item[] = [
  { href: '/', label: 'Início', Ico: IcoInicio },
  { href: '/estoque', label: 'Estoque', Ico: IcoEstoque },
  // -- O botão central (FAB) de compras entrará aqui visualmente --
   // Encurtado para caber melhor
  { href: '/cmv', label: 'CMV', Ico: IcoCmv },
  { href: '/fichas', label: 'Fichas', Ico: IcoFichas },
  { href: '/comparativo', label: 'Comparar', Ico: IcoComparativo },
];

export default function AppNav() {
  const path = usePathname();
  const router = useRouter();
  const ativo = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  async function sair() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* ---------- desktop ---------- */}
      <aside className="side">
        <Link href="/" className="side-brand">
          <Image src="/logo.png" alt="" width={40} height={40} priority />
          <div>
            <div className="n">SmashKings</div>
            <div className="s">Gestão · 2 unidades</div>
          </div>
        </Link>

        <nav className="side-nav">
          {todos.map(({ href, label, Ico }) => (
            <Link key={href} href={href} className={ativo(href) ? 'act' : ''} aria-current={ativo(href) ? 'page' : undefined}>
              <Ico size={19} />
              {label}
            </Link>
          ))}
        </nav>

        <Link href="/compras" className="side-new">
          <IcoMais size={17} />
          Nova compra
        </Link>

        <button className="side-foot" onClick={sair}>
          <IcoSair size={17} />
          Sair
        </button>
      </aside>

      {/* ---------- celular ---------- */}
      <nav className="bnav">
        {/* Renderiza os 2 primeiros itens (Início e Estoque) na esquerda */}
        {barra.slice(0, 2).map(({ href, label, Ico }) => (
          <Link key={href} href={href} className={'nb' + (ativo(href) ? ' act' : '')} aria-current={ativo(href) ? 'page' : undefined}>
            <Ico size={21} />
            {label}
          </Link>
        ))}

        {/* Botão central (FAB) */}
        <Link href="/compras" className="fab" aria-label="Registrar compra">
          <IcoMais size={24} />
        </Link>

        {/* Renderiza os 3 últimos itens (Comparar, CMV e Fichas) na direita */}
        {barra.slice(2).map(({ href, label, Ico }) => (
          <Link key={href} href={href} className={'nb' + (ativo(href) ? ' act' : '')} aria-current={ativo(href) ? 'page' : undefined}>
            <Ico size={21} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}