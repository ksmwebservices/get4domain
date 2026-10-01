'use client';

import { useEffect, useState } from 'react';
import type { Service } from './services';
import { services as fallbackServices, resolveServices } from './services';
import { fetchSiteData } from './site-data';
import type { PortfolioPhoto } from './portfolio';
import { fallbackPhotos } from './portfolio';

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

/** Live categorized portfolio gallery (VendorCMS.portfolio) - starts with the
 *  uploaded showcase's own static photo array (so first paint is never empty)
 *  and swaps in the vendor's real uploads once fetched, if any exist yet. Real
 *  photos get no grid span override (span was a deliberate curator choice for
 *  the static showcase, not something a vendor configures). */
export function usePortfolio(): { photos: PortfolioPhoto[]; loading: boolean } {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>(fallbackPhotos);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchSiteData().then((site) => {
      if (cancelled) return;
      const real = site?.cms?.portfolio;
      if (real && real.length > 0) {
        setPhotos(real.map((p) => ({ src: p.src, title: p.title || '', category: p.category || 'Celebration', span: '' })));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return { photos, loading };
}
