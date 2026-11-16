import type { Metadata } from 'next';
import Crumbs from '@/components/site/Crumbs';
import JsonLd from '@/components/directory/JsonLd';
import { getFirm } from '@/lib/v3-public/firm';
import { assertV3Public } from '@/lib/v3-public/guard';
import { organizationLd } from '@/lib/v3-public/site-jsonld';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.about.metaTitle, description: SITE.about.metaDescription, path: '/about' });
}

export default function AboutPage() {
  assertV3Public();
  const A = SITE.about;
  const firm = getFirm();
  return (
    <>
      <JsonLd items={[organizationLd()]} />
      <Crumbs here={A.h1} path="/about" />
      <h1 className="text-3xl font-bold text-slate-900">{A.h1}</h1>
      <div className="mt-4 space-y-3 text-slate-700">
        {A.body.map((t) => <p key={t}>{t}</p>)}
        <p>{A.firmLine.replace('{name}', firm.name).replace('{address}', firm.address)}</p>
      </div>
    </>
  );
}
