import type { MetadataRoute } from 'next';

// AI / LLM crawlers we explicitly welcome (full access). This is our origin's source of
// truth: if Cloudflare's injected "Managed content" block is ever removed or stops
// overriding, the app still serves the correct, permissive rules for these bots.
// (The `Content-Signal` line in the live file is injected by Cloudflare, not here.)
const AI_BOTS = [
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'CCBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'ChatGPT-User',
  'CloudflareBrowserRenderingCrawler',
  'Google-Extended',
  'GPTBot',
  'meta-externalagent',
  'PerplexityBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Every AI crawler above: explicit Allow, full site — no disallows.
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      // Everyone else (incl. Googlebot): allowed, minus the private app paths.
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/admin/',
          '/customer/',
          '/api/',
          '/login',
          '/register',
          '/_next/',
        ],
      },
    ],
    sitemap: 'https://get4domain.com/sitemap.xml',
    host: 'get4domain.com',
  };
}
