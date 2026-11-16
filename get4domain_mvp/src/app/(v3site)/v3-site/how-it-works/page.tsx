import type { Metadata } from 'next';
import Link from 'next/link';
import Crumbs from '@/components/site/Crumbs';
import { assertV3Public } from '@/lib/v3-public/guard';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.how.metaTitle, description: SITE.how.metaDescription, path: '/how-it-works' });
}

export default function HowItWorksPage() {
  assertV3Public();
  const W = SITE.how;
  return (
    <>
      <Crumbs here={W.h1} path="/how-it-works" />
      <h1 className="text-3xl font-bold text-slate-900">{W.h1}</h1>
      <ol className="mt-6 space-y-5">
        {W.steps.map((s) => (<li key={s.title}><h2 className="text-xl font-semibold text-slate-900">{s.title}</h2><p className="mt-1 text-slate-700">{s.body}</p></li>))}
      </ol>
      <p className="mt-8 text-sm text-slate-600">{W.note}</p>
      <p className="mt-6"><Link href="/register" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{W.cta}</Link></p>
    </>
  );
}
