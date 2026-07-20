import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://get4domain.com'),
  title: 'Get4Domain — Your Online Identity Partner | BOS Websites for Indian SMBs',
  description: 'Get4Domain gives Indian SMBs a complete digital platform — professional websites, business management software and managed digital marketing.',
  keywords: [
    'business website india', 'domainapp', 'domaincampaign',
    'business management software india', 'managed digital marketing india',
    'SMB software india', 'GST invoice software', 'CRM india',
    'business launch platform india', 'digital marketing agency india',
  ],
  authors: [{ name: 'Get4Domain' }],
  creator: 'Get4Domain',
  publisher: 'Get4Domain',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
  alternates: { canonical: 'https://get4domain.com' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://get4domain.com',
    siteName: 'Get4Domain',
    title: 'Get4Domain — Professional Business Launch Made Easy',
    description: "India's SaaS platform for professional business websites, digital marketing and business management.",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get4Domain — Professional Business Launch Made Easy',
    description: "India's SaaS platform for professional business websites, digital marketing and business management.",
    site: '@get4domain',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Get4Domain',
              url: 'https://get4domain.com',
              logo: 'https://get4domain.com/logo.png',
              description: "India's SaaS platform for professional business websites, digital marketing and business management.",
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Chennai',
                addressRegion: 'Tamil Nadu',
                addressCountry: 'IN',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+91-98765-43210',
                contactType: 'customer support',
                availableLanguage: ['English', 'Tamil', 'Hindi'],
              },
              sameAs: [
                'https://www.facebook.com/get4domain',
                'https://www.instagram.com/get4domain',
                'https://www.linkedin.com/company/get4domain',
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Get4Domain',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: [
                { '@type': 'Offer', name: 'DomainApp Startup', price: '6999', priceCurrency: 'INR' },
                { '@type': 'Offer', name: 'DomainApp Enterprise', price: '24999', priceCurrency: 'INR' },
                { '@type': 'Offer', name: 'DomainCampaign Starter', price: '6999', priceCurrency: 'INR' },
                { '@type': 'Offer', name: 'DomainCampaign Business', price: '29999', priceCurrency: 'INR' },
              ],
            }),
          }}
        />
      </head>
      <body className="font-sans text-slate-700 bg-white antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
