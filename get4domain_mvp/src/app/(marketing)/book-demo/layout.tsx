import type { Metadata } from 'next';
import { siteConfig } from '@/constants/site';

export const metadata: Metadata = {
  title: 'Book a Free Demo — Get4Domain | See How It Works in 30 Minutes',
  description: 'Book a free 30-minute demo with our team. See Get4Domain in action for your industry. No commitment. Our consultant calls within 24 hours.',
  alternates: { canonical: 'https://get4domain.com/book-demo' },
  openGraph: {
    title: 'Book a Free Demo — Get4Domain',
    description: 'See Get4Domain in action for your industry. Free 30-minute demo, no commitment.',
    url: 'https://get4domain.com/book-demo',
    type: 'website',
    // Shared hero banner — required here because Next replaces (not merges) openGraph.
    images: [siteConfig.ogImage],
  },
};

export default function BookDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
