import type { ReactNode } from 'react';
import JsonLd from '@/components/directory/JsonLd';
import PageHero, { type Crumb } from '@/components/portal/PageHero';
import { breadcrumbLd } from '@/lib/v3-public/site-jsonld';
import { SITE } from '@/lib/v3-public/site-strings';

/** The top band of a content page plus its BreadcrumbList JSON-LD (left out when the main host is not set: no address is guessed). `crumbs` are the levels after Home. */
export default function PageHead({ crumbs, h1, lead, actions, aside, eyebrow }: { crumbs: Crumb[]; h1: string; lead?: string; actions?: ReactNode; aside?: ReactNode; eyebrow?: string }) {
  const ld = breadcrumbLd([{ name: SITE.crumbs.home, path: '/' }, ...crumbs]);
  return (
    <>
      {ld ? <JsonLd items={[ld]} /> : null}
      <PageHero crumbs={crumbs} h1={h1} lead={lead} actions={actions} aside={aside} eyebrow={eyebrow} />
    </>
  );
}
