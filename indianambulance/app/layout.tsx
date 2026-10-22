import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ContentProvider } from '@/components/ContentContext'
import { getContent } from '@/lib/content'
import { SITE_URL } from '@/lib/site-url'

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent()
  // the owner's own search title, description and share picture win once they have written them; until then the exported wording stays
  const ogDesc = c.connected ? c.seo.description : 'Emergency and patient transport assistance available 24 hours in Tindivanam, Tamil Nadu.'
  const logo = c.logo
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: c.seo.title,
      template: `%s | ${c.name}`,
    },
    description: c.seo.description,
    keywords: c.seo.keywords,
    applicationName: c.name,
    authors: [{ name: c.name }],
    creator: c.name,
    publisher: c.name,
    alternates: { canonical: '/' },
    ...(c.connected && c.seo.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      url: '/',
      siteName: c.name,
      title: c.seo.title,
      description: ogDesc,
      images: [{ url: c.seo.image, width: 512, height: 512, alt: `${c.name} logo` }],
    },
    twitter: {
      card: 'summary',
      title: c.seo.title,
      description: ogDesc,
      images: [c.seo.image],
    },
    icons: {
      icon: c.seo.favicon || logo,
      shortcut: c.seo.favicon || logo,
      apple: c.seo.favicon || logo,
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const content = await getContent()
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        <ContentProvider value={content}>{children}</ContentProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
