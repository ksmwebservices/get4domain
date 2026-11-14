import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { siteConfig, BRAND_TAGLINE, BRAND_TITLE, BRAND_DESCRIPTION } from '@/constants/site';
import { organizationSameAs } from '@/lib/structured-data';
import GoogleAnalytics from '@/components/seo/GoogleAnalytics';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://get4domain.com'),
  title: {
    default: BRAND_TITLE,
    template: '%s | Get4Domain',
  },
  description: BRAND_DESCRIPTION,
  keywords: [
    'business website India',
    'online identity platform India',
    'business operating system India',
    'CRM for Indian SMBs',
    'digital marketing platform India',
    'GST invoice software',
    'business management software India',
    'all-in-one business app for SMBs India',
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
  // Brand-level defaults. There is deliberately NO url here (a fixed home url would be stamped on any page that sets no
  // openGraph of its own). Every page that sets its own openGraph / twitter replaces these wholesale, so they never
  // override page values; every marketing page goes through createPageMetadata.
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Get4Domain',
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Get4Domain',
              legalName: 'KSM Quantum Technologies',
              alternateName: ['Get4Domain.com', 'Get4 Domain'],
              url: 'https://get4domain.com',
              logo: 'https://get4domain.com/logo.png',
              description: BRAND_DESCRIPTION,
              slogan: BRAND_TAGLINE,
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
                email: 'support@get4domain.com',
                contactType: 'customer support',
                availableLanguage: ['English', 'Tamil'],
                hoursAvailable: 'Mo-Sa 09:00-20:00',
              },
              // From siteConfig.social; "#" and empty placeholders are skipped, so this is [] until real profile URLs are filled in.
              sameAs: organizationSameAs(),
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
              description: BRAND_DESCRIPTION,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              offers: [
                {
                  '@type': 'Offer',
                  name: 'DomainApp Workspace — billed annually (₹999/month equivalent), excl. 18% GST',
                  price: '11988',
                  priceCurrency: 'INR',
                  url: 'https://get4domain.com/pricing#domainapp',
                },
                {
                  '@type': 'Offer',
                  name: 'DomainApp BOS — billed annually (₹1,999/month equivalent), excl. 18% GST',
                  price: '23988',
                  priceCurrency: 'INR',
                  url: 'https://get4domain.com/pricing#domainapp',
                },
              ],
              provider: {
                '@type': 'Organization',
                name: 'KSM Quantum Technologies',
                url: 'https://get4domain.com',
                logo: 'https://get4domain.com/logo.png',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Get4Domain',
              url: 'https://get4domain.com',
              description: BRAND_DESCRIPTION,
              inLanguage: 'en-IN',
              publisher: { '@type': 'Organization', name: 'Get4Domain' },
              // SearchAction removed: its target (/industries?q=) is not a real search. The industries page ignores ?q.
            }),
          }}
        />
      </head>
      <body className="font-sans text-slate-700 bg-white antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
