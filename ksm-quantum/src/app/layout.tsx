import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { SITE, OG_IMAGE } from '@/data/site';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'KSM Quantum Technologies — Building Software, Empowering Businesses',
    template: '%s | KSM Quantum Technologies',
  },
  description:
    'KSM Quantum Technologies is a Chennai-based technology company (est. 2014) that builds and operates its own software products, AI-powered platforms and digital business solutions — including Get4Domain, SignBot, NextBOS and HiDude.',
  keywords: [
    'KSM Quantum Technologies', 'technology company Chennai', 'software product company India',
    'AI platform company', 'Get4Domain', 'SignBot', 'NextBOS', 'HiDude', 'K S Murugavel',
  ],
  authors: [{ name: 'KSM Quantum Technologies' }],
  creator: 'KSM Quantum Technologies',
  publisher: 'KSM Quantum Technologies',
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    type: 'website', locale: 'en_IN', url: SITE.url, siteName: SITE.name,
    title: 'KSM Quantum Technologies — Building Software, Empowering Businesses',
    description: 'A Chennai technology company building software products, AI platforms and digital business solutions since 2014.',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KSM Quantum Technologies',
    description: 'Building software products, AI platforms and digital business solutions since 2014. Chennai, India.',
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07070c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    alternateName: 'KSM Quantum',
    url: SITE.url,
    slogan: SITE.tagline,
    foundingDate: SITE.founded,
    founder: { '@type': 'Person', name: 'K. S. Murugavel', jobTitle: 'Founder & CEO' },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Tidel Park, 1st Floor D Block',
      addressLocality: 'Tharamani, Chennai',
      addressRegion: 'Tamil Nadu',
      postalCode: '600113',
      addressCountry: 'IN',
    },
    contactPoint: { '@type': 'ContactPoint', email: SITE.email, contactType: 'business', areaServed: 'IN', availableLanguage: ['English', 'Tamil'] },
    owns: [
      { '@type': 'Product', name: 'Get4Domain', url: 'https://get4domain.com' },
      { '@type': 'Product', name: 'SignBot', url: 'https://signbot.in' },
      { '@type': 'Product', name: 'NextBOS', url: 'https://nextbos.ai' },
      { '@type': 'Product', name: 'HiDude', url: 'https://hidude.ai' },
    ],
  };
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    inLanguage: 'en-IN',
    publisher: { '@type': 'Organization', name: SITE.name },
  };

  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      </head>
      <body className="font-sans">
        <div className="bg-sweep" aria-hidden />
        <div className="bg-grid" aria-hidden />
        <Nav />
        <main className="pt-16 md:pt-20">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
