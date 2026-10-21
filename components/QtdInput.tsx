'use client';
import { compativeis, rotulo, type Medida } from '@/lib/medidas';

/**
 * Campo de quantidade com a medida ao lado: para um insumo em kg dá para
 * digitar em g ou kg; em L, ml ou L. Trocar a medida não muda o número
 * digitado (500 + "g" = 500 g). Quem usa converte com lerQtd() ao salvar.
 */
export default function QtdInput({
  id, base, texto, medida, onChange, placeholder, rotuloAria, onBlur, onKeyDown, autoFocus,
}: {
  id?: string;
  base?: string | null;
  texto: string;
  medida: Medida;
  onChange: (texto: string, medida: Medida) => void;
  placeholder?: string;
  rotuloAria?: string;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  const opcoes = compativeis(base);
  return (
    // onBlur só quando o foco sai do conjunto: ir do número para a medida não conta
    <div className="qtd-un" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlur?.(); }}>
      <input
        id={id} inputMode="decimal" value={texto} placeholder={placeholder} aria-label={rotuloAria}
        onChange={(e) => onChange(e.target.value, medida)} onKeyDown={onKeyDown} autoFocus={autoFocus}
      />
      {opcoes.length > 1 ? (
        <select value={medida} onChange={(e) => onChange(texto, e.target.value as Medida)} aria-label="Medida">
          {opcoes.map((m) => <option key={m} value={m}>{rotulo(m)}</option>)}
        </select>
      ) : (
        <span>{rotulo(base)}</span>
      )}
    </div>
  );
}
