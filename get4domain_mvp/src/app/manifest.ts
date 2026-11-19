import type { MetadataRoute } from 'next';
import { BRAND_TITLE } from '@/constants/site';

/**
 * The web app manifest, one for every host (it is a dotted path, so the middleware never touches it and the directory host answers it too).
 * Icons are local files under /icons (drawn by scripts/pwa/make-icons.mjs). start_url "/" is the home of whichever host installs the app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND_TITLE,
    short_name: 'Get4Domain',
    description: 'Search local businesses and domain names, and put your business online with a website, a business web app and enquiry capture.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    lang: 'en-IN',
    orientation: 'portrait',
    prefer_related_applications: false,
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Search', url: '/search', icons: [{ src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Plans', url: '/pricing', icons: [{ src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
