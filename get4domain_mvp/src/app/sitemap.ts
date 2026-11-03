import type { MetadataRoute } from 'next';
const BASE = 'https://get4domain.com';

const pages = [
  { path: '/' },
  { path: '/leadspace' },
  { path: '/managed-services' },
  { path: '/domain-app' },
  { path: '/pricing' },
  { path: '/industries' },
  { path: '/features' },
  { path: '/how-it-works' },
  { path: '/book-demo' },
  { path: '/portfolio' },
  { path: '/templates' },
  { path: '/contact' },
  { path: '/support' },
  { path: '/about' },
  { path: '/terms' },
  { path: '/privacy-policy' },
  { path: '/refund-policy' },
];

const industries = [
  'restaurant', 'travel', 'realestate', 'clinic', 'education',
  'construction', 'retail', 'salon', 'gym', 'professional',
  'events', 'finance', 'automobile', 'logistics', 'diagnostics',
  'hotel', 'photography', 'technology', 'agriculture', 'coaching',
];

export default function sitemap(): MetadataRoute.Sitemap {
  // Only the address. The old lastModified was the moment of the request (so it changed on every fetch and Google learned to ignore it), and the flat
  // priority/changeFrequency values are ignored by Google. A real last-modified date needs a source of truth; until there is one, none is better than a false one.
  const staticPages = pages.map(({ path }) => ({ url: `${BASE}${path}` }));
  const industryPages = industries.map((id) => ({ url: `${BASE}/industries/${id}` }));

  // Demo pages (/demo/*) are deliberately NOT listed: they are behind an OTP gate (middleware redirects every visit to /visit-demo), so a crawler can only
  // ever see the redirect. Listing them made ~680 URLs resolve to one gate page (docs/v3/SEO_0_PLAN.md, D2).

  return [...staticPages, ...industryPages];
}
