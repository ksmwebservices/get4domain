import { NextResponse } from 'next/server';

const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

/**
 * A visitor tapped "Buy online" on an item. We count the tap for the vendor (never charged) and send the visitor to the address the vendor saved.
 * The address is looked up on our server from the saved item, never taken from this request, so this cannot be used to send people anywhere else.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; n: string }> }): Promise<NextResponse> {
  const { slug, n } = await ctx.params;
  const index = Number(n);
  const back = new URL(`/ls/${encodeURIComponent(slug)}`, _req.url);
  if (!Number.isInteger(index) || index < 0 || index > 39) return NextResponse.redirect(back, 302);
  try {
    const res = await fetch(`${API}/leadspace/public/outbound`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, index }), cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as { data?: { url?: string } };
    const url = json.data?.url;
    if (res.ok && url && /^https:\/\//i.test(url)) return NextResponse.redirect(url, 302);
  } catch { /* fall through: the visitor stays on the page */ }
  return NextResponse.redirect(back, 302);
}
