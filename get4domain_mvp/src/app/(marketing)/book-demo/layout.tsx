import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Free Demo — Get4Domain | See How It Works in 30 Minutes',
  description: 'Book a free 30-minute demo with our team. See Get4Domain in action for your industry. No commitment. Our consultant calls within 24 hours.',
};

export default function BookDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
