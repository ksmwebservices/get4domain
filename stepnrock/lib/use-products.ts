'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Product } from './products';
import { fetchSiteData, fetchVendorCategories, resolveProducts } from './site-data';

/** Live product catalogue for client-component pages (shop, shop/[category], product/[slug]).
 *  It starts EMPTY and `loading`, and shows exactly what the shop's API returns — no made-up showcase products
 *  flash first. `failed` is true when the shop's data could not be reached (show a retry, not an empty shop).
 *  `reload()` re-fetches (used by the cart to re-check availability). */
export function useProducts(): { products: Product[]; loading: boolean; failed: boolean; reload: () => void } {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then((site) => {
      if (cancelled) return;
      setFailed(site === null);
      setProducts(resolveProducts(site));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  const reload = useCallback(() => { setLoading(true); setTick((t) => t + 1); }, []);
  return { products, loading, failed, reload };
}

export interface CategoryChip {
  slug: string;
  name: string;
}

/** Live category filter chips — the vendor's real categories, in the order they chose, hidden ones removed. If the categories
 *  call fails we fall back to the distinct categories of the products, so a chip can never point at a category that has no products
 *  because it was invented client-side. Starts empty (no static showcase chips). */
export function useCategories(): { categories: CategoryChip[]; loading: boolean } {
  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then(async (site) => {
      if (cancelled) return;
      const vendorId = site?.vendor?.id;
      const real = vendorId ? await fetchVendorCategories(vendorId) : null;
      if (cancelled) return;
      if (real && real.length > 0) {
        setCategories(real.map((c) => ({ slug: c.nameNormalized, name: c.name })));
      } else if (site) {
        const seen = new Map<string, string>();
        for (const p of site.products) {
          const name = (p.category ?? '').trim();
          if (name) seen.set(name.toLowerCase(), name);
        }
        setCategories(Array.from(seen.entries()).map(([slug, name]) => ({ slug, name })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { categories, loading };
}
