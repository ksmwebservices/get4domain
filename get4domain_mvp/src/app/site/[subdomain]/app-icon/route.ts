import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import { fetchAppIdentity } from '@/lib/v3-public/site-kit/app-data';
import { iconSize } from '@/lib/v3-public/site-kit/pwa';

export const dynamic = 'force-dynamic';

/** The vendor's app icon: the first letter of the business name on the theme's accent colour, a PNG at 180, 192 or 512 px. ?m=1 keeps the letter inside the maskable safe zone. */
export async function GET(req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const id = await fetchAppIdentity(subdomain);
  if (!id) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  const u = new URL(req.url);
  const size = iconSize(u.searchParams.get('s'));
  const maskable = u.searchParams.get('m') === '1';
  const el = createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: id.accent, color: id.accentFg, fontSize: Math.round(size * (maskable ? 0.4 : 0.56)), fontWeight: 800, borderRadius: maskable ? 0 : Math.round(size * 0.22) } }, id.letter);
  return new ImageResponse(el, { width: size, height: size, headers: { 'cache-control': 'public, max-age=300' } });
}
