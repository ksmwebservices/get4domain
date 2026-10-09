// Sitemap of verified, published LeadSpace pages. The API builds it; this route only passes it on so it is served from the main domain.
const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${API}/leadspace/public/sitemap.xml`, { next: { revalidate: 3600 } });
    if (res.ok) return new Response(await res.text(), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  } catch {
    /* fall through to the empty sitemap */
  }
  return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
