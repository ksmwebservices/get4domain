import type { Metadata } from 'next';
import './globals.css';
import { BookingModalProvider } from '@/components/BookingModalContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BookingModal from '@/components/BookingModal';
import MobileBottomNav from '@/components/MobileBottomNav';
import ChatBot from '@/components/ChatBot';

export const metadata: Metadata = {
  title: 'Allwin Tours & Travels — Cuddalore',
  description: 'Premium cab services and tour packages from Cuddalore, Tamil Nadu.',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a3a5c" />
      </head>
      <body className="antialiased">
        <BookingModalProvider>
          <Navbar />
          <main className="pb-16 md:pb-0">{children}</main>
          <Footer />
          <ChatBot />
          <MobileBottomNav />
          <BookingModal />
        </BookingModalProvider>
      </body>
    </html>
  );
}
