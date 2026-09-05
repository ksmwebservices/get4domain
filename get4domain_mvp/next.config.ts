import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    // Demo imagery is now self-hosted under public/demo-library (no external host).
    // Vendor / AI-Studio banners come from Supabase Storage and render via plain <img>,
    // which needs no allowlist. Add a remotePattern here only if a next/image component
    // is ever pointed at a remote host.
    remotePatterns: [],
  },
};

export default nextConfig;
