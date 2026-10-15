// Ícones em SVG inline (traço), no estilo do layout aprovado.
// Sem dependência externa — cada ícone herda a cor via `currentColor`.
import type { ReactNode } from 'react';

type IconProps = { size?: number; sw?: number; className?: string };

function Svg({ size = 20, sw = 1.8, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IcoInicio = (p: IconProps) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /></Svg>
);

export const IcoEstoque = (p: IconProps) => (
  <Svg {...p}><path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" /><path d="M3 7.5v9L12 21l9-4.5v-9" /><path d="M12 12v9" /></Svg>
);

export const IcoCmv = (p: IconProps) => (
  <Svg {...p}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></Svg>
);

export const IcoFichas = (p: IconProps) => (
  <Svg {...p}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Svg>
);

export const IcoCompras = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h3l2.2 11h9.3L21 7H6.5" />
    <circle cx="9.5" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
  </Svg>
);

export const IcoPedidos = (p: IconProps) => (
  <Svg {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></Svg>
);

export const IcoComparativo = (p: IconProps) => (
  <Svg {...p}><path d="M12 3v18" /><path d="M8 21h8" /><path d="M5 7h14" /><path d="M5 7 2 14h6L5 7Z" /><path d="M19 7l-3 7h6l-3-7Z" /></Svg>
);

export const IcoMais = (p: IconProps) => <Svg sw={2.2} {...p}><path d="M12 5v14M5 12h14" /></Svg>;

export const IcoSair = (p: IconProps) => (
  <Svg sw={2} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
);

export const IcoSubiu = (p: IconProps) => <Svg sw={2.6} {...p}><path d="M3 17 10 10l4 4 7-7" /><path d="M15 6h6v6" /></Svg>;

export const IcoCaiu = (p: IconProps) => <Svg sw={2.6} {...p}><path d="M3 7 10 14l4-4 7 7" /><path d="M15 18h6v-6" /></Svg>;

export const IcoDinheiro = (p: IconProps) => (
  <Svg {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></Svg>
);

export const IcoAlerta = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4M12 17h.01" /></Svg>
);

export const IcoNota = (p: IconProps) => (
  <Svg {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></Svg>
);

export const IcoCustos = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 18V6" />
  </Svg>
);

export const IcoProdutos = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11a8 8 0 0 1 16 0" />
    <path d="M2 11h20" />
    <path d="M4 15h16" />
    <path d="M3 19h18a1 1 0 0 0 1-1v-1H2v1a1 1 0 0 0 1 1z" />
  </Svg>
);

export const IcoPreparos = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 13.8a4.5 4.5 0 1 1 2.6-8.3 5 5 0 0 1 6.8 0 4.5 4.5 0 1 1 2.6 8.3" />
    <path d="M6 14h12v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7z" />
    <line x1="6" y1="18" x2="18" y2="18" />
  </Svg>
);

export const IcoChat = (p: IconProps) => (
  <Svg {...p}><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 10h8M8 13h5" /></Svg>
);

export const IcoEnviar = (p: IconProps) => (
  <Svg {...p}><path d="M4 12l16-8-6 16-3-6-7-2Z" /></Svg>
);

export const IcoBusca = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

export const IcoFechar = (p: IconProps) => <Svg sw={2.2} {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;

export const IcoSeta = (p: IconProps) => <Svg sw={2} {...p}><path d="m9 6 6 6-6 6" /></Svg>;

export const IcoLixo = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></Svg>
);

export const IcoCamera = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></Svg>
);

export const IcoArquivo = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></Svg>
);

export const IcoGrade = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Svg>
);

export const IcoAjuste = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
);

export const IcoOk = (p: IconProps) => <Svg sw={2.2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;

export const IcoProducao = (p: IconProps) => (
  <Svg {...p}><path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7Z" /><path d="M2 10h20" /><path d="M9 6.5c0-1 1-1.5 1-2.5M14 6.5c0-1 1-1.5 1-2.5" /></Svg>
);

export const IcoTransferir = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h14l-3.5-3.5" /><path d="M20 16H6l3.5 3.5" /></Svg>
);
