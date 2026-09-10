import type { MetadataRoute } from 'next';
import { SITE } from '@/data/site';

// AI / LLM crawlers we explicitly welcome (GEO) — same pattern as get4domain_mvp.
const AI_BOTS = [
  'Amazonbot', 'Applebot-Extended', 'Bytespider', 'CCBot', 'ClaudeBot', 'Claude-SearchBot',
  'ChatGPT-User', 'CloudflareBrowserRenderingCrawler', 'Google-Extended', 'GPTBot',
  'meta-externalagent', 'PerplexityBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      { userAgent: '*', allow: '/' },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: 'ksmquantum.get4domain.com',
  };
}
