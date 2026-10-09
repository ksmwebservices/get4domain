import type { NextConfig } from 'next';

// LeadSpace pages live at /ls/<slug>. When LEADSPACE_BASE_DOMAIN is set (for example "get4domain.page"), <slug>.<that domain> is served by the same
// page. Off by default, so no existing site changes; turning it on also needs a wildcard DNS record and an nginx server block (docs/v2/LEADSPACE.md).
const leadspaceDomain = (process.env.LEADSPACE_BASE_DOMAIN ?? '').trim().toLowerCase();

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    // Demo imagery is now self-hosted under public/demo-library (no external host).
    // Vendor / AI-Studio banners come from Supabase Storage and render via plain <img>,
    // which needs no allowlist. Add a remotePattern here only if a next/image component
    // is ever pointed at a remote host.
    remotePatterns: [],
  },
  async rewrites() {
    if (!leadspaceDomain) return [];
    const escaped = leadspaceDomain.replace(/\./g, '\\.');
    return {
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: `(?<slug>[a-z0-9-]+)\\.${escaped}` }], destination: '/ls/:slug' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
