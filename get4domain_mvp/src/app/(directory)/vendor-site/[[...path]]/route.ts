import { headers } from 'next/headers';
import { DEV_VENDOR_HEADER, devRedirectLocation, devVendorViewEnabled, prefixRootLinks } from '@/lib/v3-public/dev-vendor';
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
  // Developer machines only: the middleware names the vendor host from the /_vendor/{subdomain} address. Ignored unless the switch is on (never in a production build).
  const devHost = devVendorViewEnabled() ? h.get(DEV_VENDOR_HEADER) : null;
  const host = devHost ?? h.get('host');
  if (!devHost && (!hostRoutingActive() || classifyHost(host, readHostConfig()).kind !== 'vendor-site')) return vendorFor(vendorResponseParts({ kind: 'not-found' }, req.method), req.method);
  const segments = (await ctx.params).path ?? [];
  const path = `/${segments.join('/')}`;
  const r = await fetchVendorPage(String(host).toLowerCase().split(':')[0], path, { ifNoneMatch: req.headers.get('if-none-match'), forwardedFor: forwardedFor(req) });
  const parts = vendorResponseParts(r, req.method);
  // the dev view only: root-relative links of a stored HTML page point back under the dev address so that clicking through works
  if (devHost && parts.body && /text\/html/i.test(parts.headers['content-type'] ?? '')) {
    const { etag: _etag, ...rest } = parts.headers;
    return vendorFor({ ...parts, headers: { ...rest, 'cache-control': 'no-store' }, body: prefixRootLinks(parts.body, devHost.split('.')[0]) }, req.method);
  }
  if (devHost && parts.headers.location) return vendorFor({ ...parts, headers: { ...parts.headers, location: devRedirectLocation(parts.headers.location, devHost) } }, req.method);
  return vendorFor(parts, req.method);
}

function vendorFor(p: { status: number; headers: Record<string, string>; body: string | null }, method: string): Response {
  return new Response(method === 'HEAD' || p.status === 304 ? null : p.body, { status: p.status, headers: p.headers });
}

export const GET = handle;
export const HEAD = handle;
