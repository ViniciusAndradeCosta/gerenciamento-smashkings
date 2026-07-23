'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import UnitSwitcher from './UnitSwitcher';

export default function Header({ sub }: { sub?: string }) {
  const router = useRouter();
  const sair = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };
  return (
    <header className="hdr">
      <div className="hdr-top">
        <div className="logo-i">🍔</div>
        <div>
          <div className="logo-t">SmashKings</div>
          <div className="logo-s">{sub || '2 unidades'}</div>
        </div>
        <div className="hdr-out" onClick={sair}>Sair</div>
      </div>
      <Suspense fallback={<div className="useg" />}>
        <UnitSwitcher />
      </Suspense>
    </header>
  );
}
