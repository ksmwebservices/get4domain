import type { Metadata } from 'next';
import ModelPage from '@/components/directory/ModelPage';
import { ErrorState } from '@/components/directory/States';
import { apiBase } from '@/lib/v3-public/config';
import { getPageModel } from '@/lib/v3-public/data';
import { useMocks } from '@/lib/v3-public/flag';
import { assertV3Public } from '@/lib/v3-public/guard';
import { modelToMetadata, noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

/** The directory home. The model's home path is "/", which the marketing home owns, so this page lives at /directory and renders that model. */
export async function generateMetadata(): Promise<Metadata> {
  assertV3Public();
  const r = await getPageModel('/');
  return r.kind === 'ok' ? modelToMetadata(r.data) : noindexMetadata(`${S.error.title} | ${S.brand}`, S.error.body);
}

export default async function DirectoryHome() {
  assertV3Public();
  const r = await getPageModel('/');
  if (r.kind !== 'ok') return <ErrorState path="/directory" notConfigured={!useMocks() && !apiBase()} />;
  return <ModelPage model={r.data} />;
}
