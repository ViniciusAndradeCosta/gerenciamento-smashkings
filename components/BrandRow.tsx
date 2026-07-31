'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IcoSair } from './Icons';

/**
 * Linha da marca no topo. No desktop o logo, o nome e o "Sair" somem
 * (ficam no menu lateral) — sobra só o subtítulo/saudação.
 */
export default function BrandRow({ sub }: { sub: string }) {
  const router = useRouter();
  async function sair() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <div className="brand">
      <Image className="bmark" src="/logo.png" alt="" width={40} height={40} priority />
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
