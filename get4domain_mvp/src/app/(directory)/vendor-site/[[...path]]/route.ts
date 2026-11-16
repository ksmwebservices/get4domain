import { headers } from 'next/headers';
import { hostRoutingActive } from '@/lib/v3-public/host-routing';
import { classifyHost, readHostConfig } from '@/lib/v3-public/hostnames';
import { forwardedFor, guardResponse } from '@/lib/v3-public/proxy';
import { fetchVendorPage, vendorResponseParts } from '@/lib/v3-public/vendor-site';

export const dynamic = 'force-dynamic';

/**
 * A V3 vendor website. Reached only by the middleware rewrite (flag on, host layer on, a vendor host the backend knows): /vendor-site/{path} for <vendor>.<main domain>.
 * Relays the backend's stored page, sitemap.xml, robots.txt, llms.txt or asset unchanged (see lib/v3-public/vendor-site.ts). The host comes from the Host header, never from the address.
 */
async function handle(req: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  const off = guardResponse();
  if (off) return off;
  const h = await headers();
  const host = h.get('host');
  if (!hostRoutingActive() || classifyHost(host, readHostConfig()).kind !== 'vendor-site') return vendorFor(vendorResponseParts({ kind: 'not-found' }, req.method), req.method);
  const segments = (await ctx.params).path ?? [];
  const path = `/${segments.join('/')}`;
  const r = await fetchVendorPage(String(host).toLowerCase().split(':')[0], path, { ifNoneMatch: req.headers.get('if-none-match'), forwardedFor: forwardedFor(req) });
  return vendorFor(vendorResponseParts(r, req.method), req.method);
}

function vendorFor(p: { status: number; headers: Record<string, string>; body: string | null }, method: string): Response {
  return new Response(method === 'HEAD' || p.status === 304 ? null : p.body, { status: p.status, headers: p.headers });
}

export const GET = handle;
export const HEAD = handle;
