'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import UnitSwitcher from './UnitSwitcher';
import type { Unidade } from '@/lib/types';

function IcoSair({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IcoCustos({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  );
}

/** Topo das telas internas. Passe `unidades` só onde o filtro por unidade faz sentido. */
export default function TopBar({
  titulo, showCustoFixo = false, unidades,
}: { titulo: string; showCustoFixo?: boolean; unidades?: Unidade[] }) {
  const router = useRouter();
  const supabase = createClient();
  
  // Estados do Modal
  const [showModal, setShowModal] = useState(false);
  const [configId, setConfigId] = useState('');
  const [custoFixo, setCustoFixo] = useState('');
  const [carregandoCusto, setCarregandoCusto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Carrega sempre o ÚLTIMO custo salvo no banco ao abrir o modal
  useEffect(() => {
    if (showModal) {
      async function carregarUltimoCustoSalvo() {
        setCarregandoCusto(true);
        try {
          const { data: configData } = await supabase.from('configuracoes_loja').select('*').limit(1);
          
          if (configData && configData.length > 0) {
            setConfigId(configData[0].id);
            const val = configData[0].custo_fixo_padrao ?? configData[0].custo_salao_padrao;
            if (val !== undefined && val !== null) {
              setCustoFixo(String(val).replace('.', ','));
              setCarregandoCusto(false);
              return;
            }
          }

          const { data: prodData } = await supabase.from('produtos').select('*').limit(1);
          if (prodData && prodData.length > 0) {
            const val = prodData[0].custo_fixo ?? prodData[0].custo_extra ?? prodData[0].custo_salao ?? 1.50;
            setCustoFixo(String(val).replace('.', ','));
          } else {
            setCustoFixo('1,50');
          }
        } catch (e) {
          setCustoFixo('1,50');
        } finally {
          setCarregandoCusto(false);
        }
      }

      carregarUltimoCustoSalvo();
    }
  }, [showModal, supabase]);

  // Salva no banco de dados e atualiza todo o sistema
  async function handleSalvarCustos(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    
    const valFixo = Number(custoFixo.replace(',', '.'));

    if (isNaN(valFixo)) {
      alert('Por favor, insira um valor numérico válido.');
      setSalvando(false);
      return;
    }

    try {
      if (configId) {
        const { error } = await supabase
          .from('configuracoes_loja')
          .update({ custo_fixo_padrao: valFixo, updated_at: new Date().toISOString() })
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('configuracoes_loja')
          .insert([{ custo_fixo_padrao: valFixo }])
          .select();
        if (error) throw error;
        if (data && data[0]) setConfigId(data[0].id);
      }

      const { error: erroProdutos } = await supabase.from('produtos').update({ custo_fixo: valFixo }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (erroProdutos) throw erroProdutos;
      const { error: erroPreparos } = await supabase.from('ingredientes').update({ custo_fixo: valFixo }).eq('e_produzido_internamente', true);
      if (erroPreparos) throw erroPreparos;

      alert(`✅ Custo Fixo de R$ ${custoFixo} salvo com sucesso!`);
      setShowModal(false);
      
      window.location.reload(); 
    } catch (err: any) {
      alert('Erro ao atualizar banco de dados: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .hide-mobile { display: none; }
          .topbar-title { font-size: 18px !important; }
        }
      `}} />

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
        }}
      >
        <h1 className="topbar-title" style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'var(--txt)' }}>
          {titulo}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* BOTÃO CUSTO FIXO - Exibido apenas quando showCustoFixo={true} */}
          {showCustoFixo && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--surf)',
                color: 'var(--txt)',
                border: '1px solid var(--line)',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <IcoCustos size={16} />
              <span className="hide-mobile">Custo Fixo</span>
            </button>
          )}

          {/* BOTÃO SAIR */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--rdim)',
              color: 'var(--red)',
              border: '1px solid var(--red)',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <IcoSair size={16} />
            <span className="hide-mobile">Sair</span>
          </button>
        </div>
      </header>

      {unidades && unidades.length > 0 && (
        <Suspense fallback={<div className="useg" />}>
          <UnitSwitcher unidades={unidades} />
        </Suspense>
      )}

      {/* MODAL DE CUSTO FIXO */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '380px', padding: '24px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--line)', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--txt)', fontSize: '18px' }}>Custo Fixo Unificado</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '20px', lineHeight: '1.5' }}>
              Altere o valor do <b>Custo Fixo</b>. Ao salvar, o sistema atualizará automaticamente no banco de dados todos os seus lanches e sub-receitas.
            </p>

            <form onSubmit={handleSalvarCustos}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--dim)', fontWeight: 'bold' }}>
                  Custo Fixo (R$)
                </label>
                <input
                  type="text"
                  value={custoFixo}
                  onChange={(e) => setCustoFixo(e.target.value)}
                  placeholder={carregandoCusto ? "Carregando..." : "1,50"}
                  disabled={carregandoCusto}
                  style={{ width: '100%', padding: '14px', background: 'var(--surf)', border: '1px solid var(--line)', color: 'var(--gold)', fontSize: '18px', fontWeight: 'bold', borderRadius: '8px', outline: 'none' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={salvando || carregandoCusto}
                style={{ width: '100%', padding: '12px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {salvando ? 'Salvando no Banco...' : 'Salvar e Aplicar a Tudo'}
              </button>
            </form>
            
          </div>
        </div>
      )}
    </>
  );
}