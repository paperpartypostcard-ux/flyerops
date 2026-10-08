import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLang } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/client';

export const metadata: Metadata = { title: 'FlyerOps', description: 'Flyer distribution management for Melbourne' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#14213d' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased"><I18nProvider lang={lang}>{children}</I18nProvider></body>
    </html>
  );
}
