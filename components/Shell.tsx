'use client';
import { usePathname } from 'next/navigation';
import AppNav from './AppNav';

/**
 * Decide entre a moldura do app (menu lateral + barra inferior) e a tela
 * "nua" do login. `children` continua sendo renderizado no servidor.
 */
export default function Shell({ children }: { children: React.ReactNode }) {
  const semMoldura = usePathname() === '/login';
  if (semMoldura) return <main className="main-bare">{children}</main>;
  return (
    <>
      <AppNav />
      <main className="main">{children}</main>
    </>
  );
}
