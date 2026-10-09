import { NextRequest } from 'next/server';

/**
 * The page a customer sees when a vendor shares an invoice, quote or credit note: /d/<token>. No login. The API renders the page (so the
 * vendor's logo, GSTIN, bank / UPI and the "Pay now" button, shown only when they have their own gateway, are always current); this route
 * only serves it from the vendor-facing domain.
 */
const API = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return new Response('This link is not valid.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const thermal = req.nextUrl.searchParams.get('thermal') === '1' ? '?thermal=1' : '';
  try {
    const res = await fetch(`${API}/public/bos/doc/${token}${thermal}`, { cache: 'no-store' });
    if (!res.ok) return new Response('This link is not valid or has expired. Ask the business to send it again.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response(await res.text(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
  } catch {
    return new Response('We could not load this page right now. Please try again in a minute.', { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
