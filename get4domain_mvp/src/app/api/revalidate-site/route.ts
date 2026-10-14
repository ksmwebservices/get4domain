import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Called by the API right after a vendor presses Publish: drops the cached data of that vendor's public pages so the change shows within seconds.
 * Protected by a shared secret (REVALIDATE_SECRET, the same value in the API container). Does nothing else.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  const sent = req.headers.get('x-revalidate-secret') ?? '';
  if (!secret || sent.length !== secret.length || !timingSafeEqual(Buffer.from(sent), Buffer.from(secret))) return NextResponse.json({ ok: false, message: 'Not allowed.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { subdomain?: string };
  const sub = String(body.subdomain ?? '').toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) return NextResponse.json({ ok: false, message: 'A valid site address is required.' }, { status: 400 });
  revalidateTag(`site:${sub}`);
  return NextResponse.json({ ok: true, refreshed: sub });
}
