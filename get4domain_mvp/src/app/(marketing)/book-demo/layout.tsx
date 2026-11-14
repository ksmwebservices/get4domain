import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Book a Free Demo',
  description: 'Book a free 30-minute demo with our team. See Get4Domain in action for your industry. No commitment. Our consultant calls within 24 hours.',
  path: '/book-demo',
});

export default function BookDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
