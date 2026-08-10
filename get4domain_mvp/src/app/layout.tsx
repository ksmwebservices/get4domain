import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://get4domain.com'),
  title: {
    default: 'Get4Domain — Your Online Identity Partner | Business Platform for Indian SMBs',
    template: '%s | Get4Domain',
  },
  description: "Get4Domain is India's complete online identity platform. Professional websites, business operations, CRM, AI marketing campaigns, invoicing and more — all in one platform. Starting ₹999.",
  keywords: [
    'business website India',
    'online identity platform India',
    'business operating system India',
    'CRM for Indian SMBs',
    'digital marketing platform India',
    'GST invoice software',
    'business management software India',
    'website builder for SMBs India',
    'AI content creation India',
    'social media management India',
    'lead generation India',
    'TeleCRM India',
    'WhatsApp business India',
    'get4domain',
    'domain app',
    'domain campaign',
    'travel agency website India',
    'restaurant website India',
    'clinic management software India',
    'salon booking system India',
  ],
  authors: [{ name: 'KSM Quantum Technologies' }],
  creator: 'KSM Quantum Technologies',
  publisher: 'KSM Quantum Technologies',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.png', sizes: '192x192', type: 'image/png' }],
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
    title: 'Get4Domain — Your Online Identity Partner',
    description: "India's complete online identity platform for SMBs. Website + Business Operations + Marketing. Starting ₹999.",
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
              offers: {
                '@type': 'AggregateOffer',
                lowPrice: '999',
                highPrice: '24999',
                priceCurrency: 'INR',
                offerCount: '4',
              },
              provider: {
                '@type': 'Organization',
                name: 'KSM Quantum Technologies',
                url: 'https://get4domain.com',
                logo: 'https://get4domain.com/logo.png',
              },
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
