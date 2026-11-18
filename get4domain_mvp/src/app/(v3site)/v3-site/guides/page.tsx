import type { Metadata } from 'next';
import Link from 'next/link';
import PageHead from '@/components/portal/PageHead';
import { CtaBox } from '@/components/site/Blocks';
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
      <PageHead crumbs={[{ name: G.crumb, path: '/guides' }]} h1={G.h1} lead={G.lead} />
      <ul className="grid gap-5 pt-10 md:grid-cols-2">
        {G.pages.map((g) => (
          <li key={g.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-bold text-ink-900"><Link href={guidePath(g.slug)} className="hover:underline">{g.title}</Link></h2>
            <p className="mt-2 text-sm text-slate-700">{g.lead}</p>
            <p className="mt-3 text-sm"><Link href={guidePath(g.slug)} className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">{G.read}<span className="sr-only">: {g.title}</span></Link></p>
          </li>
        ))}
      </ul>
      <CtaBox id="cta-title" heading={G.ctaHeading} body={G.ctaBody} links={[{ href: '/register', label: G.ctaPrimary }]} />
    </>
  );
}
