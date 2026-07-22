import type { Metadata } from 'next';
import './globals.css';
import { BookingModalProvider } from '@/components/BookingModalContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import BookingModal from '@/components/BookingModal';

export const metadata: Metadata = {
  title: 'Allwin Tours & Travels | Cuddalore Tamil Nadu',
  description:
    'Premium cab services, expert drivers, and unforgettable tour experiences across Tamil Nadu & South India. Pilgrimage, Packages, Airport Transfers, Weddings.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <BookingModalProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
          <BookingModal />
        </BookingModalProvider>
      </body>
    </html>
  );
}
