import './globals.css';
import type { Metadata } from 'next';
import { Playfair_Display, Cinzel, Inter } from 'next/font/google';
import { BookingProvider } from '@/components/site/BookingModal';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Deebi Wedding Stories — Wedding Photography & Cinematography | Madurai',
  description:
    'Deebi Wedding Stories by Boopathi Raja R captures timeless Indian weddings across Madurai and Tamil Nadu. Premium wedding photography, cinematography, pre-wedding, and post-wedding films.',
  keywords: [
    'wedding photography Madurai',
    'Indian wedding photographer',
    'wedding cinematography Tamil Nadu',
    'pre-wedding shoot Madurai',
    'Deebi Wedding Stories',
    'Boopathi Raja wedding photographer',
  ],
  openGraph: {
    title: 'Deebi Wedding Stories — Wedding Photography & Cinematography',
    description:
      'Timeless Indian wedding photography and cinematography by Boopathi Raja R in Madurai.',
    type: 'website',
    images: [
      {
        url: 'https://images.pexels.com/photos/17657612/pexels-photo-17657612.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://images.pexels.com/photos/17657612/pexels-photo-17657612.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${cinzel.variable} ${inter.variable}`}>
      <body className="bg-ink text-warm antialiased"><BookingProvider>{children}</BookingProvider></body>
    </html>
  );
}
