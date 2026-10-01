'use client';

import { useEffect, useState } from 'react';
import type { Service } from './services';
import { services as fallbackServices, resolveServices } from './services';
import { fetchSiteData } from './site-data';

/** Live service/package catalogue for client-component sections (the homepage
 *  Services grid) - starts with the uploaded showcase data (so first paint is never
 *  empty) and swaps in the real vendor catalogue once fetched, if any packages exist
 *  yet. */
export function useServices(): { services: Service[]; loading: boolean } {
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then((site) => {
      if (cancelled) return;
      setServices(resolveServices(site));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { services, loading };
}
