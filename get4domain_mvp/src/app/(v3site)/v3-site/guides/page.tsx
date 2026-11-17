import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBox } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { guidePath } from '@/lib/v3-public/site-routes';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: MARKETING.guides.metaTitle, description: MARKETING.guides.metaDescription, path: '/guides' });
}

export default function GuidesPage() {
  assertV3Public();
  const G = MARKETING.guides;
  return (
    <>
      <Trail items={[{ name: G.crumb, path: '/guides' }]} />
      <h1 className="text-3xl font-bold text-slate-900">{G.h1}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{G.lead}</p>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {G.pages.map((g) => (
          <li key={g.slug} className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900"><Link href={guidePath(g.slug)} className="hover:underline">{g.title}</Link></h2>
            <p className="mt-2 text-sm text-slate-700">{g.lead}</p>
            <p className="mt-3 text-sm"><Link href={guidePath(g.slug)} className="font-medium text-slate-900 underline">{G.read}<span className="sr-only">: {g.title}</span></Link></p>
          </li>
        ))}
      </ul>
      <CtaBox id="cta-title" heading={G.ctaHeading} body={G.ctaBody} links={[{ href: '/register', label: G.ctaPrimary }]} />
    </>
  );
}
