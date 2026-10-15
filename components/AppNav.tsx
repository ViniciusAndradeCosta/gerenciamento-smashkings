'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sheet from './Sheet';
import {
  IcoInicio, IcoEstoque, IcoCmv, IcoFichas, IcoCompras,
  IcoComparativo, IcoMais, IcoSair, IcoProdutos, IcoPreparos, IcoGrade, IcoProducao,
} from './Icons';

type Item = { href: string; label: string; Ico: (p: { size?: number }) => React.JSX.Element };

// menu lateral (desktop), separado em dia a dia e cadastro do cardápio
const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/', label: 'Início', Ico: IcoInicio },
      { href: '/estoque', label: 'Estoque', Ico: IcoEstoque },
      { href: '/producao', label: 'Produção', Ico: IcoProducao },
      { href: '/compras', label: 'Compras', Ico: IcoCompras },
      { href: '/cmv', label: 'CMV', Ico: IcoCmv },
      { href: '/comparativo', label: 'Comparativo', Ico: IcoComparativo },
    ],
  },
  {
    titulo: 'Cardápio',
    itens: [
      { href: '/produtos', label: 'Produtos', Ico: IcoProdutos },
      { href: '/fichas', label: 'Fichas técnicas', Ico: IcoFichas },
      { href: '/preparos', label: 'Preparos', Ico: IcoPreparos },
    ],
  },
];

// barra inferior (celular): o essencial do dia a dia + "Mais"
const barraEsq: Item[] = [
  { href: '/', label: 'Início', Ico: IcoInicio },
  { href: '/estoque', label: 'Estoque', Ico: IcoEstoque },
];
const barraDir: Item[] = [{ href: '/cmv', label: 'CMV', Ico: IcoCmv }];
const noMais: Item[] = [
  { href: '/compras', label: 'Compras', Ico: IcoCompras },
  { href: '/producao', label: 'Produção', Ico: IcoProducao },
  { href: '/produtos', label: 'Produtos', Ico: IcoProdutos },
  { href: '/fichas', label: 'Fichas', Ico: IcoFichas },
  { href: '/preparos', label: 'Preparos', Ico: IcoPreparos },
  { href: '/comparativo', label: 'Comparativo', Ico: IcoComparativo },
];

export default function AppNav() {
  const path = usePathname();
  const [mais, setMais] = useState(false);
  const ativo = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const maisAtivo = noMais.some((i) => ativo(i.href)) && !path.startsWith('/compras');

  // fecha o "Mais" ao navegar
  useEffect(() => setMais(false), [path]);

  async function sair() {
    await createClient().auth.signOut();
    window.location.replace('/login');
  }

  return (
    <>
      {/* ---------- desktop ---------- */}
      <aside className="side">
        <Link href="/" className="side-brand">
          <span className="side-logo"><Image src="/logo.png" alt="" width={84} height={84} priority /></span>
          <div>
            <div className="n">Smash Kings</div>
            <div className="s">Gestão · 2 unidades</div>
          </div>
        </Link>

        <Link href="/compras" className="side-new">
          <IcoMais size={17} />
          Nova compra
        </Link>

        <nav className="side-nav">
          {grupos.map((g) => (
            <div key={g.titulo} className="side-grupo">
              <div className="side-gt">{g.titulo}</div>
              {g.itens.map(({ href, label, Ico }) => (
                <Link key={href} href={href} className={ativo(href) ? 'act' : ''} aria-current={ativo(href) ? 'page' : undefined}>
                  <Ico size={19} />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button className="side-foot" onClick={sair}>
          <IcoSair size={17} />
          Sair
        </button>
      </aside>

      {/* ---------- celular ---------- */}
      <nav className="bnav">
        {barraEsq.map(({ href, label, Ico }) => (
          <Link key={href} href={href} className={'nb' + (ativo(href) ? ' act' : '')} aria-current={ativo(href) ? 'page' : undefined}>
            <Ico size={21} />
            {label}
          </Link>
        ))}

        <Link href="/compras" className={'fab' + (path.startsWith('/compras') ? ' act' : '')} aria-label="Registrar compra">
          <IcoMais size={24} />
        </Link>

        {barraDir.map(({ href, label, Ico }) => (
          <Link key={href} href={href} className={'nb' + (ativo(href) ? ' act' : '')} aria-current={ativo(href) ? 'page' : undefined}>
            <Ico size={21} />
            {label}
          </Link>
        ))}

        <button type="button" className={'nb' + (maisAtivo ? ' act' : '')} onClick={() => setMais(true)} aria-haspopup="dialog">
          <IcoGrade size={21} />
          Mais
        </button>
      </nav>

      <Sheet aberto={mais} titulo="Menu" subtitulo="Smash Kings · Gestão" onFechar={() => setMais(false)}>
        <div className="mais-grade">
          {noMais.map(({ href, label, Ico }) => (
            <Link key={href} href={href} className={'atalho' + (ativo(href) ? ' act' : '')}>
              <span><Ico size={21} /></span>
              {label}
            </Link>
          ))}
        </div>
        <button type="button" className="bt bt-sec bt-bloco mais-sair" onClick={sair}>
          <IcoSair size={17} />
          Sair da conta
        </button>
      </Sheet>
    </>
  );
}
