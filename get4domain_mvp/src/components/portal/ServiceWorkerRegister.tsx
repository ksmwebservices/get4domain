'use client';

import { useEffect } from 'react';

/**
 * Registers the site's service worker (/sw.js) once a public page has loaded. It is rendered by the portal shell only, which exists only while V3_PUBLIC_ENABLED is on,
 * so with the flag off nothing here runs. The worker never caches pages or API answers (see public/sw.js). A failed registration is ignored: the site works the same without it.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const go = (): void => { navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    return () => window.removeEventListener('load', go);
  }, []);
  return null;
}
