'use client';

import { useEffect, useState } from 'react';
import { fetchSiteData, type LiveSiteData } from './site-data';

/** The real vendor/site record (for checkout: subdomain, paymentsEnabled, business
 *  name) — same fetch as useProducts, exposed separately so components that only
 *  need site-level fields don't have to reach into the product list. */
export function useSiteData(): { site: LiveSiteData | null; loading: boolean } {
  const [site, setSite] = useState<LiveSiteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then((s) => {
      if (cancelled) return;
      setSite(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { site, loading };
}
