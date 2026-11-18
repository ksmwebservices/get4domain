import type { Metadata } from 'next';
import ModelPage from '@/components/directory/ModelPage';
import { ErrorState } from '@/components/directory/States';
import DirectoryBrowse from '@/components/portal/DirectoryBrowse';
import DirectoryHero from '@/components/portal/DirectoryHero';
import { apiBase } from '@/lib/v3-public/config';
import { getPageModel } from '@/lib/v3-public/data';
import { useMocks } from '@/lib/v3-public/flag';
import { assertV3Public } from '@/lib/v3-public/guard';
import { baseDomain, readHostConfig } from '@/lib/v3-public/hostnames';
import { modelToMetadata, noindexMetadata } from '@/lib/v3-public/metadata';
import { fetchTrees } from '@/lib/v3-public/portal-search';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { PORTAL } from '@/lib/v3-public/portal-strings';
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
  const l = portalLinks();
  const [r, t] = await Promise.all([getPageModel('/'), fetchTrees()]);
  const base = baseDomain(readHostConfig());
  return (
    <>
      <DirectoryHero h1={PORTAL.directory.h1} lead={PORTAL.directory.lead} search={{ action: l.search, registerHref: l.main('/register'), suffix: base ? `.${base}` : '', idPrefix: 'dir' }} />
      <div className="pt-10">
        <DirectoryBrowse trees={t.kind === 'ok' ? t.data : null} searchHref={l.search} />
        <div className="mt-10">
          {r.kind === 'ok' ? <ModelPage model={r.data} headless /> : <ErrorState path="/directory" notConfigured={!useMocks() && !apiBase()} />}
        </div>
      </div>
    </>
  );
}
