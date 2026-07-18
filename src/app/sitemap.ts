import type { MetadataRoute } from 'next';

const BASE = 'https://get4domain.com';

// All public-facing pages with correct SEO priorities
const pages: { path: string; priority: number; changeFreq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',                   priority: 1.0,  changeFreq: 'weekly' },
  { path: '/domain-app',         priority: 0.95, changeFreq: 'monthly' },
  { path: '/domain-campaign',    priority: 0.95, changeFreq: 'monthly' },
  { path: '/pricing',            priority: 0.9,  changeFreq: 'monthly' },
  { path: '/industries',         priority: 0.9,  changeFreq: 'monthly' },
  { path: '/book-demo',          priority: 0.9,  changeFreq: 'monthly' },
  { path: '/how-it-works',       priority: 0.8,  changeFreq: 'monthly' },
  { path: '/portfolio',          priority: 0.8,  changeFreq: 'weekly'  },
  { path: '/contact',            priority: 0.75, changeFreq: 'monthly' },
  { path: '/support',            priority: 0.7,  changeFreq: 'monthly' },
  { path: '/terms',              priority: 0.3,  changeFreq: 'yearly'  },
  { path: '/privacy-policy',     priority: 0.3,  changeFreq: 'yearly'  },
  { path: '/refund-policy',      priority: 0.3,  changeFreq: 'yearly'  },
];

// Industry sub-pages — each one is a landing target for GMB / local SEO
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

  // Industry anchor links — /industries#restaurant etc become crawlable signals
  const industryPages = industries.map((id) => ({
    url: `${BASE}/industries`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }));

  return [...staticPages];
}
