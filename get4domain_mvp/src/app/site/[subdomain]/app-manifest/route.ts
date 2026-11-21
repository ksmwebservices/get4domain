import { fetchAppIdentity, manifestFor } from '@/lib/v3-public/site-kit/app-data';

export const dynamic = 'force-dynamic';

/** The vendor's own web app manifest (name, colours, icons), answered on the vendor's host at /app-manifest. A dotless path, so the vendor-host rewrite reaches it. */
export async function GET(_req: Request, { params }: { params: Promise<{ subdomain: string }> }): Promise<Response> {
  const { subdomain } = await params;
  const id = await fetchAppIdentity(subdomain);
  if (!id) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  return new Response(JSON.stringify(manifestFor(id)), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
