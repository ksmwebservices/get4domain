import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BusinessPage from '@/components/directory/BusinessPage';
import ModelPage from '@/components/directory/ModelPage';
import { ErrorState, GoneState } from '@/components/directory/States';
import { apiBase } from '@/lib/v3-public/config';
import { getPageModel, pathFromSegments } from '@/lib/v3-public/data';
import { useMocks } from '@/lib/v3-public/flag';
import { assertV3Public } from '@/lib/v3-public/guard';
import { modelToMetadata, noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

// Rendered on every request: the flag is read from the environment each time and nothing directory-related is ever kept on disk. The API data is cached by fetch revalidate.
// KNOWN LIMIT (docs/v3/PUBLIC_GAPS.md G9): the live site's root app/loading.tsx flushes a loading shell before this page runs, so notFound() here is sent as HTTP 200 with
// a noindex page, exactly as every unknown address on the live site already is. Without that file the same code answers a real 404.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ path: string[] }> };

/** The catch-all of the directory: the backend resolves the path, this page only renders the model it gets back. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  assertV3Public();
  const path = pathFromSegments((await params).path);
  if (!path) notFound();
  const r = await getPageModel(path);
  if (r.kind === 'notFound') notFound();
  if (r.kind === 'gone') return noindexMetadata(`${S.gone.title} | ${S.brand}`, S.gone.body);
  if (r.kind === 'error') return noindexMetadata(`${S.error.title} | ${S.brand}`, S.error.body);
  return modelToMetadata(r.data);
}

export default async function DirectoryPage({ params }: Props) {
  assertV3Public();
  const path = pathFromSegments((await params).path);
  if (!path) notFound();
  const r = await getPageModel(path);
  if (r.kind === 'notFound') notFound(); // unknown address or a page past the last: a real 404
  if (r.kind === 'gone') return <GoneState />;
  if (r.kind === 'error') return <ErrorState path={path} notConfigured={!useMocks() && !apiBase()} />;
  return r.data.type === 'business' ? <BusinessPage model={r.data} /> : <ModelPage model={r.data} />;
}
