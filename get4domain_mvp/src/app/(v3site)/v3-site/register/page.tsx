import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import RegisterForm from '@/components/site/RegisterForm';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { assertV3Public } from '@/lib/v3-public/guard';
import { baseDomain, readHostConfig } from '@/lib/v3-public/hostnames';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { fetchCategories } from '@/lib/v3-public/packs';
import { fetchPlans } from '@/lib/v3-public/plans';
import { PLAN_KEYS, TERMS } from '@/lib/v3-public/register';
import { REFERRAL_COOKIE, referralCodeOk } from '@/lib/v3-public/referral';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  // the form is for people, not for search: a plan or term in the address never makes a second indexed page
  return siteMetadata({ title: SITE.register.metaTitle, description: SITE.register.metaDescription, path: '/register', noindex: true });
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  assertV3Public();
  const q = await searchParams;
  const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');
  const plan = PLAN_KEYS.includes(one(q.plan)) ? one(q.plan) : 'free';
  const termNum = Number(one(q.term));
  const term = plan !== 'free' && TERMS.includes(termNum) ? termNum : null;
  const [cats, plans, jar] = await Promise.all([fetchCategories(), fetchPlans(), cookies()]);
  const planName = plan === 'free' ? null : plans.kind === 'ok' ? plans.data.plans.find((x) => x.key === plan)?.name ?? null : null;
  // ?pack= comes from an industry page; only a published pack counts, anything else is ignored
  const packPage = publishedIndustries().find((x) => x.pack.key === one(q.pack)) ?? null;
  const base = baseDomain(readHostConfig());
  return (
    <>
      <h1 className="text-3xl font-bold text-slate-900">{SITE.register.h1}</h1>
      <p className="mb-6 mt-2 text-slate-600">{SITE.register.intro}</p>
      <div className="max-w-xl">
        <RegisterForm
          categories={cats.kind === 'ok' ? cats.data.map((c) => ({ key: c.categoryKey, name: c.name, industry: c.family || c.packKey.toLowerCase(), packKey: c.packKey })) : []}
          categoriesFailed={cats.kind !== 'ok'}
          pack={packPage?.pack.key ?? null}
          packName={packPage?.pack.name ?? null}
          plan={plan}
          planName={planName}
          term={term}
          termName={term ? SITE.pricing.terms[term] ?? null : null}
          referral={referralCodeOk(jar.get(REFERRAL_COOKIE)?.value)}
          vendorUrl={vendorAppUrl()}
          suffix={base ? `.${base}` : ''}
        />
      </div>
    </>
  );
}
