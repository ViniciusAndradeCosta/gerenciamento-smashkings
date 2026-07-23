import './globals.css';
import type { Metadata, Viewport } from 'next';
import BottomNav from '@/components/BottomNav';
import SW from '@/components/SW';

export const metadata: Metadata = {
  title: 'SmashKings — Gestão',
  description: 'Sistema de gestão SmashKings: estoque, CMV, compras e IA das duas unidades.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'SmashKings' },
};
export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <BottomNav />
        <SW />
      </body>
    </html>
  );
}
