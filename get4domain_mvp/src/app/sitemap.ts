import type { MetadataRoute } from 'next';

const BASE = 'https://get4domain.com';

const pages = [
  { path: '/',                 priority: 1.0,  changeFreq: 'weekly' as const },
  { path: '/domain-campaign',  priority: 0.95, changeFreq: 'monthly' as const },
  { path: '/domain-app',       priority: 0.95, changeFreq: 'monthly' as const },
  { path: '/pricing',          priority: 0.9,  changeFreq: 'monthly' as const },
  { path: '/industries',       priority: 0.9,  changeFreq: 'monthly' as const },
  { path: '/book-demo',        priority: 0.9,  changeFreq: 'monthly' as const },
  { path: '/contact',          priority: 0.75, changeFreq: 'monthly' as const },
  { path: '/support',          priority: 0.7,  changeFreq: 'monthly' as const },
  { path: '/about',            priority: 0.7,  changeFreq: 'monthly' as const },
  { path: '/terms',            priority: 0.3,  changeFreq: 'yearly' as const },
  { path: '/privacy-policy',   priority: 0.3,  changeFreq: 'yearly' as const },
  { path: '/refund-policy',    priority: 0.3,  changeFreq: 'yearly' as const },
];

const industries = [
  'restaurant', 'travel', 'realestate', 'healthcare', 'education',
  'construction', 'retail', 'beauty', 'fitness', 'professional',
  'events', 'finance', 'automobile', 'logistics', 'diagnostics',
  'hotel', 'photography', 'technology', 'agriculture', 'coaching',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = pages.map(({ path, priority, changeFreq }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: changeFreq,
    priority,
  }));

  const industryPages = industries.map((id) => ({
    url: `${BASE}/industries/${id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }));

  return [...staticPages, ...industryPages];
}
