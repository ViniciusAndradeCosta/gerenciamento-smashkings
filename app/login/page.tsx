'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IcoEstoque, IcoCmv, IcoNota } from '@/components/Icons';

/** Coroa da marca (mesmo desenho do ícone do app), usada só como enfeite. */
function Coroa({ className }: { className: string }) {
  return (
    <svg className={'login-coroa ' + className} viewBox="166 174 180 174" aria-hidden="true">
      <path d="M176 296 L196 196 L232 246 L256 184 L280 246 L316 196 L336 296 Z" />
      <rect x="176" y="312" width="160" height="26" rx="13" />
    </svg>
  );
}

/**
 * Só entrar: contas novas são criadas pelo painel do Supabase
 * (Authentication → Users → Add user), não por esta tela.
 */
export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErro(
        err?.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : err?.message || 'Erro ao entrar.'
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <span className="login-brilho" aria-hidden="true" />
        <Coroa className="cr-h1" />
        <Coroa className="cr-h2" />

        <div className="login-logo">
          <div className="login-logo-img">
            <Image src="/logo.png" alt="Smash Kings" width={422} height={420} sizes="(min-width: 900px) 240px, 200px" priority />
          </div>
        </div>
        {/* o logo já traz o nome; o título diz o que é o sistema */}
        <h1>Sistema de gestão</h1>
        <p>2 unidades · um só controle</p>

        <ul className="login-feats">
          <li><span><IcoEstoque size={17} /></span>Estoque e compras</li>
          <li><span><IcoCmv size={17} /></span>CMV e fichas técnicas</li>
          <li><span><IcoNota size={17} /></span>Nota fiscal com IA</li>
        </ul>
      </section>

      <div className="login-side">
        <Coroa className="cr-s1" />
        <Coroa className="cr-s2" />

        <div className="login-box">
          <h2 className="login-h">Entrar</h2>
          <p className="login-s">Acesse com a conta da hamburgueria.</p>

          {erro && <div className="msg err">{erro}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@smashkings.com" autoComplete="email" required
                inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next"
              />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <div className="senha-wrap">
                <input
                  id="senha" type={verSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••" minLength={6} autoComplete="current-password" required
                  autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go"
                />
                <button
                  type="button" className="senha-ver" onClick={() => setVerSenha((v) => !v)}
                  aria-pressed={verSenha} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {verSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <button className="btn prim" disabled={carregando}>
              {carregando ? 'Aguarde…' : 'Entrar'}
            </button>
          </form>

          <p className="login-foot">Problemas para entrar? Fale com o administrador.</p>
        </div>
      </div>
    </div>
  );
}
