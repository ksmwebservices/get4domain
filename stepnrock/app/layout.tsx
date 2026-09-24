import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Archivo } from 'next/font/google';
import { CartProvider } from '@/lib/cart-context';
import { ChatProvider } from '@/components/chatbot/ChatProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomNav } from '@/components/layout/BottomNav';
import { ChatWidget } from '@/components/chatbot/ChatWidget';
import { PWAInstaller } from '@/components/layout/PWAInstaller';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' });

export const viewport: Viewport = {
  themeColor: '#FF4500',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://stepnrock.com'),
  title: {
    default: 'Step N Rock — Premium Footwear & Apparel | Shop Sneakers, Shoes & Streetwear',
    template: '%s | Step N Rock',
  },
  description:
    'Step N Rock — a neighbourhood footwear & apparel store in Vadapalani, Chennai since 2011. Shop sneakers, running shoes, formal shoes, sandals, hoodies & more. Free shipping over ₹999. Installable PWA.',
  keywords: [
    'footwear', 'sneakers', 'running shoes', 'formal shoes', 'sandals', 'apparel',
    'streetwear', 'hoodies', 't-shirts', 'shoe store', 'online shoe shopping',
    'Step N Rock', 'buy shoes online', 'athletic shoes', 'casual shoes',
    'shoe store Chennai', 'footwear Vadapalani', 'shoes Chennai',
    'Step N Rock Vadapalani', 'Rahaat Plaza footwear', 'Chennai shoe shop',
  ],
  authors: [{ name: 'Step N Rock' }],
  creator: 'Step N Rock',
  publisher: 'Step N Rock',
  alternates: { canonical: 'https://stepnrock.com' },
  manifest: '/manifest.json',
  applicationName: 'Step N Rock',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Step N Rock',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://stepnrock.com',
    siteName: 'Step N Rock',
    title: 'Step N Rock — Premium Footwear & Apparel',
    description: 'Shop premium sneakers, running shoes, formal shoes, sandals, and streetwear at Step N Rock, Vadapalani, Chennai. Free shipping over ₹999.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Step N Rock — Footwear & Apparel, Vadapalani, Chennai' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Step N Rock — Premium Footwear & Apparel',
    description: 'Shop premium sneakers, running shoes, formal shoes, sandals, and streetwear at Step N Rock, Vadapalani, Chennai. Free shipping over ₹999.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  category: 'shopping',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`}>
      <body className="font-sans antialiased">
        <CartProvider>
          <ChatProvider>
            <Header />
            <main className="min-h-screen pb-20 md:pb-0">{children}</main>
            <Footer />
            <BottomNav />
            <ChatWidget />
            <PWAInstaller />
          </ChatProvider>
        </CartProvider>
      </body>
    </html>
  );
}
