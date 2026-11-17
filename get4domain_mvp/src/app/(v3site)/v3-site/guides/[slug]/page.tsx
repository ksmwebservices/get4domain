import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CtaBox } from '@/components/site/Blocks';
import Trail from '@/components/site/Trail';
import { assertV3Public } from '@/lib/v3-public/guard';
import { MARKETING } from '@/lib/v3-public/marketing-strings';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { guidePath } from '@/lib/v3-public/site-routes';

export const dynamic = 'force-dynamic';

const find = (slug: string) => MARKETING.guides.pages.find((p) => p.slug === slug) ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  assertV3Public();
  const g = find((await params).slug);
  if (!g) notFound();
  return siteMetadata({ title: g.title, description: g.metaDescription, path: guidePath(g.slug) });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  assertV3Public();
  const g = find((await params).slug);
  if (!g) notFound();
  const G = MARKETING.guides;
  const more = g.links.map((s) => find(s)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <>
      <Trail items={[{ name: G.crumb, path: '/guides' }, { name: g.title, path: guidePath(g.slug) }]} />
      <article>
        <h1 className="text-3xl font-bold text-slate-900">{g.title}</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">{g.lead}</p>
        {g.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-xl font-semibold text-slate-900">{s.h}</h2>
            {s.body.map((t) => <p key={t} className="mt-2 max-w-2xl text-slate-700">{t}</p>)}
          </section>
        ))}
      </article>
      <section aria-labelledby="more-title" className="mt-10">
        <h2 id="more-title" className="text-xl font-semibold text-slate-900">{G.relatedHeading}</h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {more.map((m) => <li key={m.slug}><Link href={guidePath(m.slug)} className="font-medium text-slate-900 underline">{m.title}</Link></li>)}
          <li><Link href="/guides" className="font-medium text-slate-900 underline">{G.hubLink}</Link></li>
        </ul>
      </section>
      <CtaBox id="cta-title" heading={G.ctaHeading} body={G.ctaBody} links={[{ href: '/register', label: G.ctaPrimary }, { href: '/pricing', label: MARKETING.product.ctaSecondary }]} />
    </>
  );
}
