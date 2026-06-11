import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { MaintenanceBanner } from '@/components/feature-flags/maintenance-banner';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const geist = Inter({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s — MGM Atlas',
    default: 'MGM Atlas — Project Portfolio',
  },
  description:
    'Discover, manage, and contribute to active research projects at MGM Laboratory.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://atlas.labmgm.org'),
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-white antialiased">
        <Providers>
          <MaintenanceBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
