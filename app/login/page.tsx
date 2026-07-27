'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(''); setAviso(''); setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
        if (error) throw error;
        if (!data.session) {
          setAviso('Conta criada. Confirme o e-mail que enviamos antes de entrar.');
          setCarregando(false);
          return;
        }
      }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErro(
        err?.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : err?.message || 'Erro ao autenticar.'
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <Image src="/logo.png" alt="SmashKings" width={78} height={78} priority />
        <h1 className="login-h">SmashKings</h1>
        <p className="login-s">Sistema de gestão · 2 unidades</p>

        {erro && <div className="msg err">{erro}</div>}
        {aviso && <div className="msg ok">{aviso}</div>}

        <form onSubmit={submit}>
          {modo === 'criar' && (
            <div className="field">
              <label htmlFor="nome">Seu nome</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Laura" autoComplete="name" required />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@smashkings.com" autoComplete="email" required
            />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••" minLength={6}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} required
            />
          </div>
          <button className="btn prim" disabled={carregando}>
            {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          className="login-alt"
          onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(''); setAviso(''); }}
        >
          {modo === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tenho conta — entrar'}
        </button>
      </div>
    </div>
  );
}
