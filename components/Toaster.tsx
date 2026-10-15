'use client';
import { useEffect, useState } from 'react';
import { IcoAlerta, IcoOk } from './Icons';

type Tipo = 'ok' | 'erro';
type Aviso = { id: number; texto: string; tipo: Tipo };

/**
 * Avisos rápidos no rodapé da tela, no lugar do alert() do navegador.
 * Qualquer componente chama `avisar('Compra registrada!')` ou
 * `avisar('Erro ao salvar', 'erro')`.
 */
export function avisar(texto: string, tipo: Tipo = 'ok') {
  window.dispatchEvent(new CustomEvent<Omit<Aviso, 'id'>>('sk-aviso', { detail: { texto, tipo } }));
}

let proximoId = 1;

export default function Toaster() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    function receber(e: Event) {
      const { texto, tipo } = (e as CustomEvent<Omit<Aviso, 'id'>>).detail;
      const id = proximoId++;
      setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
      setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3200);
    }
    window.addEventListener('sk-aviso', receber);
    return () => window.removeEventListener('sk-aviso', receber);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={'toast ' + a.tipo} role={a.tipo === 'erro' ? 'alert' : 'status'}>
          {a.tipo === 'erro' ? <IcoAlerta size={18} /> : <IcoOk size={18} />}
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}
