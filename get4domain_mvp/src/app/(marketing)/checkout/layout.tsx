import type { Metadata } from 'next';

// Checkout is a transactional page — keep it out of the index (and off the homepage
// canonical it would otherwise inherit from the root layout).
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://get4domain.com/checkout' },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
