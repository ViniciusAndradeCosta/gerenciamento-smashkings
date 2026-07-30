'use client';
import { useEffect, useRef, useState } from 'react';
import { perguntar, type Mensagem } from '@/app/chat/actions';
import { IcoChat, IcoEnviar } from './Icons';

const SUGESTOES = [
  'Quanto vendi hoje?',
  'Qual o CMV do mês?',
  'O que está acabando no estoque?',
  'Compare as unidades',
];

/**
 * O modelo às vezes responde em markdown (**negrito**). Aqui a gente converte
 * `**texto**` em negrito de verdade, sem mostrar os asteriscos. As quebras de
 * linha continuam preservadas pelo CSS (white-space: pre-wrap).
 */
function formatar(texto: string) {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? <b key={i}>{parte}</b> : parte
  );
}

export default function ChatAssistente() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [modoLocal, setModoLocal] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens, enviando]);

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || enviando) return;

    const historico = mensagens;
    setMensagens((m) => [...m, { autor: 'user', texto: q }]);
    setEntrada('');
    setEnviando(true);

    const r = await perguntar(q, historico);
    setEnviando(false);

    if (r.ok) {
      if (r.modo === 'local') setModoLocal(true);
      setMensagens((m) => [...m, { autor: 'assistant', texto: r.resposta }]);
    } else {
      setMensagens((m) => [...m, { autor: 'assistant', texto: `⚠️ ${r.erro}` }]);
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll">
        {mensagens.length === 0 && (
          <div className="chat-empty">
            <div className="chat-ic"><IcoChat size={24} /></div>
            <p><b>Oi! Eu sou o King</b> 👑<br />Pergunte sobre a operação — vendas, CMV, estoque, compras e comparativo entre as unidades — que eu respondo com os números reais.</p>
            <div className="chat-chips">
              {SUGESTOES.map((s) => (
                <button key={s} className="chat-chip" onClick={() => enviar(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className={'chat-msg ' + (m.autor === 'user' ? 'user' : 'bot')}>
            {m.autor === 'user' ? m.texto : formatar(m.texto)}
          </div>
        ))}

        {enviando && <div className="chat-typing">digitando…</div>}
        <div ref={fim} />
      </div>

      {modoLocal && (
        <div className="chat-nota">
          Modo local (sem IA). Para respostas mais livres, configure a <code>GEMINI_API_KEY</code>.
        </div>
      )}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(entrada);
        }}
      >
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder="Pergunte alguma coisa…"
          aria-label="Sua pergunta"
          enterKeyHint="send"
        />
        <button type="submit" disabled={enviando || !entrada.trim()} aria-label="Enviar">
          <IcoEnviar size={20} />
        </button>
      </form>
    </div>
  );
}
