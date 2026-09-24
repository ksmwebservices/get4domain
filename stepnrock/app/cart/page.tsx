import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';

export const metadata: Metadata = {
  title: 'Your Cart — Step N Rock',
  description: 'Review your items and proceed to checkout. Free shipping on orders over ₹999.',
  alternates: { canonical: 'https://stepnrock.com/cart' },
  openGraph: {
    title: 'Your Cart — Step N Rock',
    description: 'Review your items and proceed to checkout.',
    url: 'https://stepnrock.com/cart',
  },
};

export default function CartPage() {
  return <CartView />;
}
