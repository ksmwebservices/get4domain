'use client';

import { useEffect, useState } from 'react';
import type { Product } from './products';
import { products as fallbackProducts, categories as fallbackCategories } from './products';
import { fetchSiteData, fetchVendorCategories, resolveProducts } from './site-data';

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

export interface CategoryChip {
  slug: string;
  name: string;
}

/** Live category filter chips (shop page sidebar/mobile sheet) — starts with the
 *  static showcase category list (so first paint is never empty) and swaps in the
 *  vendor's real categories once fetched, so a genuinely new category (added via
 *  any product's category field) shows up as a filter chip automatically, with no
 *  code change. Falls back to the static list if the site or categories fetch
 *  fails, or if the vendor has no categories yet. */
export function useCategories(): { categories: CategoryChip[]; loading: boolean } {
  const [categories, setCategories] = useState<CategoryChip[]>(
    fallbackCategories.map((c) => ({ slug: c.slug, name: c.name }))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then(async (site) => {
      if (cancelled) return;
      const vendorId = site?.vendor?.id;
      if (!vendorId) {
        setLoading(false);
        return;
      }
      const real = await fetchVendorCategories(vendorId);
      if (cancelled) return;
      if (real && real.length > 0) {
        setCategories(real.map((c) => ({ slug: c.nameNormalized, name: c.name })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { categories, loading };
}
