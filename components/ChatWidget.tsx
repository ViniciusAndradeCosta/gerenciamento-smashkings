'use client';
import { useState } from 'react';
import ChatAssistente from './ChatAssistente';

/**
 * Botão flutuante do King (o mascote assistente) que abre o chat num painel
 * sobreposto. Fica montado em todas as telas (menos o login) — a conversa é
 * preservada enquanto você navega, e só some ao recarregar a página.
 *
 * A foto do King fica em /public/king.png. Se o arquivo não existir, o botão
 * cai num 🍔 como reserva, então nunca fica quebrado.
 */
export default function ChatWidget() {
  const [aberto, setAberto] = useState(false);
  const [semFoto, setSemFoto] = useState(false);

  return (
    <>
      <div
        className="chat-widget"
        style={{ display: aberto ? 'flex' : 'none' }}
        role="dialog"
        aria-label="King, o assistente"
      >
        <div className="chat-widget-head">
          <span>👑 King · Assistente</span>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar o King">✕</button>
        </div>
        <div className="chat-widget-body">
          <ChatAssistente />
        </div>
      </div>

      <div className="chat-fab-wrap">
        {!aberto && (
          <span className="chat-fab-hello" aria-hidden="true">
            Oi! Eu sou o <b>King</b> 👑<br />Em que posso ajudar?
          </span>
        )}
        <button
          type="button"
          className="chat-fab"
          onClick={() => setAberto((a) => !a)}
          aria-label={aberto ? 'Fechar o King' : 'Falar com o King'}
          aria-expanded={aberto}
        >
          {aberto ? (
            <span className="chat-fab-x">✕</span>
          ) : semFoto ? (
            '🍔'
          ) : (
            <img
              src="/king.png"
              alt="King"
              className="chat-fab-img"
              onError={() => setSemFoto(true)}
            />
          )}
        </button>
      </div>
    </>
  );
}
