import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import { fetchAppIdentity } from '@/lib/v3-public/site-kit/app-data';
import { iconSize } from '@/lib/v3-public/site-kit/pwa';

export const dynamic = 'force-dynamic';

/** The logo as a data URI (png, jpeg or gif up to 1 MB: what the image renderer can draw), or null: a missing, slow, oversized or other kind of logo gives the initials icon instead. */
async function logoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 300 } });
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!r.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 0 && buf.length <= 1_000_000 ? `data:${type};base64,${buf.toString('base64')}` : null;
  } catch { return null; }
}

/** The vendor's app icon: the vendor's logo on white when it has one, else the first letter of the business name on the theme's accent colour, a PNG at 180, 192 or 512 px. ?m=1 keeps the letter inside the maskable safe zone. */
export async function GET(req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const id = await fetchAppIdentity(subdomain);
  if (!id) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  const u = new URL(req.url);
  const size = iconSize(u.searchParams.get('s'));
  const maskable = u.searchParams.get('m') === '1';
  const logo = await logoData(id.logo);
  const inner = Math.round(size * (maskable ? 0.56 : 0.72));
  const el = logo
    ? createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: maskable ? 0 : Math.round(size * 0.22) } }, createElement('img', { src: logo, width: inner, height: inner, style: { objectFit: 'contain' } }))
    : createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: id.accent, color: id.accentFg, fontSize: Math.round(size * (maskable ? 0.4 : 0.56)), fontWeight: 800, borderRadius: maskable ? 0 : Math.round(size * 0.22) } }, id.letter);
  return new ImageResponse(el, { width: size, height: size, headers: { 'cache-control': 'public, max-age=300' } });
}
