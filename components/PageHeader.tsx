import type { ReactNode } from 'react';

/**
 * Cabeçalho padrão das telas internas: título, subtítulo, ações à direita e,
 * embaixo, um espaço opcional (filtro de unidade, abas...). No celular fica
 * grudado no topo; no desktop vira o título da página.
 */
export default function PageHeader({
  titulo, subtitulo, acoes, children,
}: { titulo: string; subtitulo?: string; acoes?: ReactNode; children?: ReactNode }) {
  return (
    <header className="ph">
      <div className="ph-in">
        <div className="ph-txt">
          <h1 className="ph-tit">{titulo}</h1>
          {subtitulo && <p className="ph-sub">{subtitulo}</p>}
        </div>
        {acoes && <div className="ph-acoes">{acoes}</div>}
      </div>
      {children && <div className="ph-extra">{children}</div>}
    </header>
  );
}
