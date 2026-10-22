/**
 * Copy to `<app>/src/app/api/revalidate-site/route.ts` (or `<app>/app/api/revalidate-site/route.ts`). The backend calls this after the owner presses Publish
 * (REVALIDATE_SECRET is the same long random string in the backend and in the app's container). It only drops the cached copy of the site; it never changes anything.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get('x-revalidate-secret') !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  let subdomain = '';
  try { subdomain = String(((await req.json()) as { subdomain?: string }).subdomain ?? ''); } catch { /* no body */ }
  if (!/^[a-z0-9-]{1,63}$/.test(subdomain)) return NextResponse.json({ ok: false }, { status: 400 });
  // Next 16 needs the second argument (the other client apps are on an older Next, where the master file has one); expire 0 drops the cached copy at once, as Publish expects
  revalidateTag(`site:${subdomain}`, { expire: 0 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
