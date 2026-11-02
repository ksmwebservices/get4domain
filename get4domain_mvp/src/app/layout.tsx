import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { siteConfig } from '@/constants/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://get4domain.com'),
  title: {
    default: 'Get4Domain — Your Online Visible Partner',
    template: '%s | Get4Domain',
  },
  description:
    'Get4Domain is your online visible partner: a professional website for your business, built fast, with the tools to capture leads, take bookings and grow.',
  authors: [{ name: 'KSM Quantum Technologies' }],
  creator: 'KSM Quantum Technologies',
  publisher: 'KSM Quantum Technologies',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // NOTE: no site-wide canonical here — a canonical in the root layout is inherited by
  // EVERY page and made all of them look like duplicates of the homepage (Google then
  // refused to index them). Each page sets its OWN self-referencing canonical instead.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://get4domain.com',
    siteName: 'Get4Domain',
    title: 'Get4Domain — Your Online Visible Partner',
    description: 'Get4Domain is your online visible partner: a professional website for your business, built fast, with the tools to capture leads, take bookings and grow.',
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get4Domain — Your Online Visible Partner',
    description: 'Get4Domain is your online visible partner: a professional website for your business, built fast, with the tools to capture leads, take bookings and grow.',
    images: [siteConfig.ogImage.url],
  },
  // Search Console is already verified (the sitemap discovered 715 URLs). The old
  // placeholder here emitted a broken google-site-verification meta — removed. To add a
  // NEW verification token later, set NEXT_PUBLIC_GSC_VERIFICATION and restore this block.
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="font-sans text-slate-700 bg-white antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
