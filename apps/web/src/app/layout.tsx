import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/**
 * Fonts are loaded through next/font so they are self-hosted at build time
 * instead of requested from fonts.googleapis.com on every page view.
 *
 * This replaces a `@import url(...)` that used to sit *after* `@tailwind` in
 * globals.css. Once Tailwind expanded the directives the import landed in the
 * middle of the stylesheet, which is invalid per the CSS spec, so the browser
 * dropped it and `document.fonts.size` was 0 — the entire typographic identity
 * silently fell back to Georgia/system-ui.
 *
 * Self-hosting also means the demo keeps its typography when the venue wifi
 * drops, which is exactly when the CDN basemap will fail too.
 */
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-cormorant',
});

const body = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'SIH26162 | Industrial Thermal Intelligence',
  description:
    'Satellite-powered detection, classification and investigation of industrial thermal anomalies across India.',
  other: { 'theme-color': '#05070B' },
};

export const viewport: Viewport = {
  themeColor: '#05070B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
