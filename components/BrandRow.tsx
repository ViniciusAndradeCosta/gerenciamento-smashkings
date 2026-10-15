'use client';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { IcoSair } from './Icons';

/**
 * Linha da marca no topo. No desktop o logo, o nome e o "Sair" somem
 * (ficam no menu lateral) — sobra só o subtítulo/saudação.
 */
export default function BrandRow({ sub }: { sub: string }) {
  async function sair() {
    await createClient().auth.signOut();
    window.location.replace('/login');
  }
  return (
    <div className="brand">
      <span className="blogo bmark"><Image src="/logo.png" alt="" width={84} height={84} priority /></span>
      <div>
        <div className="bn bmark">Smash Kings</div>
        <div className="bs">{sub}</div>
      </div>
      <button className="bout bmark" onClick={sair} aria-label="Sair da conta" title="Sair">
        <IcoSair size={17} />
      </button>
    </div>
  );
}
