'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IcoFechar } from './Icons';

/**
 * Janela padrão do sistema: no celular abre de baixo para cima (bottom sheet),
 * no desktop aparece centralizada. Fecha no X, no Esc ou tocando fora.
 */
export default function Sheet({
  aberto, titulo, subtitulo, onFechar, children, rodape,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  // guarda o callback sem reinstalar os listeners a cada render
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current();
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div className="sheet-fundo" onClick={onFechar}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-alca" aria-hidden="true" />
        <div className="sheet-cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="bt bt-ic bt-ghost sheet-x" onClick={onFechar} aria-label="Fechar">
            <IcoFechar size={18} />
          </button>
        </div>
        <div className="sheet-corpo">{children}</div>
        {rodape && <div className="sheet-rodape">{rodape}</div>}
      </div>
    </div>,
    document.body
  );
}
