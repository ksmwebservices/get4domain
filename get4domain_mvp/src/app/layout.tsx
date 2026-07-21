import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://get4domain.com'),
  title: {
    default: 'Get4Domain — Your Online Identity Partner | BOS Websites for Indian SMBs',
    template: '%s | Get4Domain',
  },
  description: "Get4Domain is India's complete digital business platform. Professional websites, business management software (BOS) and managed digital marketing campaigns for Indian SMBs. Starting ₹999.",
  keywords: [
    'business website India',
    'Indian SMB digital platform',
    'business operating system India',
    'digital marketing India',
    'website for restaurant India',
    'travel agency website India',
    'clinic website India',
    'GST invoice software India',
    'lead generation India',
    'social media marketing India',
    'campaign landing page India',
    'CRM for small business India',
    'get4domain',
    'domain app',
    'domain campaign',
  ],
  authors: [{ name: 'KSM Quantum Technologies' }],
  creator: 'KSM Quantum Technologies',
  publisher: 'KSM Quantum Technologies',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.png', sizes: '64x64', type: 'image/png' }],
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
  alternates: { canonical: 'https://get4domain.com' },
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
    title: 'Get4Domain — Your Online Identity Partner | BOS Websites for Indian SMBs',
    description: "India's complete digital business platform for SMBs. Website + BOS + Digital Marketing. Starting ₹999.",
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Get4Domain' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get4Domain — Your Online Identity Partner',
    description: "India's complete digital business platform for SMBs.",
    images: ['/logo.png'],
  },
  verification: {
    google: 'ADD_YOUR_GOOGLE_SEARCH_CONSOLE_CODE_HERE',
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
        <link rel="icon" href="/favicon.ico" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Get4Domain',
              legalName: 'KSM Quantum Technologies',
              url: 'https://get4domain.com',
              logo: 'https://get4domain.com/logo.png',
              description: "India's complete digital business platform for SMBs",
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Tidel Park, 1st Floor D Block',
                addressLocality: 'Tharamani, Chennai',
                addressRegion: 'Tamil Nadu',
                postalCode: '600113',
                addressCountry: 'IN',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+917550047567',
                contactType: 'customer support',
                availableLanguage: ['English', 'Tamil'],
                hoursAvailable: 'Mo-Sa 09:00-20:00',
              },
              sameAs: [],
              foundingDate: '2026',
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
