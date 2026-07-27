import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Barlow_Condensed } from 'next/font/google';
import Shell from '@/components/Shell';
import SW from '@/components/SW';

const sans = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const cond = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-cond',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SmashKings — Gestão',
  description: 'Sistema de gestão SmashKings: estoque, CMV, compras e fichas técnicas das duas unidades.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/logo.png', apple: '/logo.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'SmashKings' },
};

export const viewport: Viewport = {
  themeColor: '#0c0c0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${cond.variable}`}>
      <body>
        <Shell>{children}</Shell>
        <SW />
      </body>
    </html>
  );
}
