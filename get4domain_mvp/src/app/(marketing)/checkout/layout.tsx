import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/metadata';

// Checkout is a transactional page — keep it out of the index. The helper gives it a self canonical
// (so it never inherits the homepage's) plus its own openGraph and twitter.
export const metadata: Metadata = createPageMetadata({
  title: 'Checkout',
  path: '/checkout',
  noindex: true,
});

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
