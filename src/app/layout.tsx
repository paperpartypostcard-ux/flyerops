import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'FlyerOps', description: 'Flyer distribution management for Melbourne' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#14213d' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
