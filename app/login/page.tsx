'use client';
import { useState } from 'react';
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
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome } },
        });
        if (error) throw error;
      }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErro(err?.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : (err?.message || 'Erro ao autenticar.'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">🍔</div>
      <div className="login-h">SmashKings</div>
      <div className="login-s">Sistema de gestão · 2 unidades</div>
      {erro && <div className="err">{erro}</div>}
      <form onSubmit={submit}>
        {modo === 'criar' && (
          <div className="field">
            <label>Seu nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Laura" required />
          </div>
        )}
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@smashkings.com" required />
        </div>
        <div className="field">
          <label>Senha</label>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" minLength={6} required />
        </div>
        <button className="btn prim" disabled={carregando}>
          {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <span className="link" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(''); }}>
        {modo === 'entrar' ? 'Não tem conta? Criar agora' : 'Já tenho conta — entrar'}
      </span>
    </div>
  );
}
