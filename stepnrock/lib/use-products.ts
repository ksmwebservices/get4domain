'use client';

import { useEffect, useState } from 'react';
import type { Product } from './products';
import { products as fallbackProducts } from './products';
import { fetchSiteData, resolveProducts } from './site-data';

/** Live product catalogue for client-component pages (shop, shop/[category],
 *  product/[slug]) — starts with the uploaded showcase data (so first paint is never
 *  empty) and swaps in the real vendor catalogue once fetched, if any products exist
 *  yet. `loading` lets a page defer a not-found check until the real fetch settles. */
export function useProducts(): { products: Product[]; loading: boolean } {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then((site) => {
      if (cancelled) return;
      setProducts(resolveProducts(site));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { products, loading };
}
