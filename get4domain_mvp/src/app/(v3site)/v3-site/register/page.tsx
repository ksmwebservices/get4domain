import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import RegisterForm from '@/components/site/RegisterForm';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { assertV3Public } from '@/lib/v3-public/guard';
import { baseDomain, readHostConfig } from '@/lib/v3-public/hostnames';
import { preselectableCategory } from '@/lib/v3-public/catalogue';
import { publishedIndustries } from '@/lib/v3-public/industries';
import { fetchCategories } from '@/lib/v3-public/packs';
import { fetchPlans, PUBLIC_TERMS } from '@/lib/v3-public/plans';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { portalPlanRows } from '@/lib/v3-public/portal-pricing';
import { familyLabel, trackOfMinTier, type CatOption, type PlanChoice } from '@/lib/v3-public/register-plan';
import { PLAN_KEYS, TERMS, trackOfTier } from '@/lib/v3-public/register';
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
  // the Pro plans with their prices as text, worked out from the public price route only (no price is written here)
  const rows = plans.kind === 'ok' ? portalPlanRows(plans.data) : [];
  const planChoices: PlanChoice[] = rows.flatMap((r) => {
    const track = trackOfTier(r.key) ?? trackOfTier(plans.kind === 'ok' ? plans.data.plans.find((x) => x.key === r.key)?.track : null);
    return track ? [{ key: r.key, name: r.name, track, pending: r.pending, monthly: r.monthly, total: r.prices }] : [];
  });
  const terms = plans.kind === 'ok' && plans.data.terms.length ? plans.data.terms : [...PUBLIC_TERMS];
  // ?pack= comes from an industry page; only a published pack counts, anything else is ignored
  // ?category= comes from a category page: only a published, known category counts; it also decides the pack
  const preset = preselectableCategory(one(q.category));
  const packPage = publishedIndustries().find((x) => x.pack.key === (preset?.packKey ?? one(q.pack))) ?? null;
  const options: CatOption[] = cats.kind === 'ok'
    ? cats.data.map((c) => ({ key: c.categoryKey, name: c.name, industry: c.family || c.packKey.toLowerCase(), packKey: c.packKey, family: c.family || c.packKey, track: trackOfMinTier(c.minTier) }))
    : [];
  // the list comes from the API; the chosen category is added from the catalogue when the API list does not carry it yet (it has no known track, so it never moves the plan)
  if (preset && !options.some((o) => o.key === preset.id)) options.push({ key: preset.id, name: preset.name, industry: preset.family || preset.packKey.toLowerCase(), packKey: preset.packKey, family: preset.family || familyLabel(preset.packKey), track: null });
  const base = baseDomain(readHostConfig());
  const links = portalLinks('main');
  return (
    <RegisterForm
      categories={options}
      categoriesFailed={cats.kind !== 'ok' && !preset}
      category={preset?.id ?? null}
      pack={packPage?.pack.key ?? null}
      packName={packPage?.pack.name ?? null}
      plan={plan}
      planChoices={planChoices}
      planNameFallback={null}
      term={term}
      terms={terms}
      referral={referralCodeOk(jar.get(REFERRAL_COOKIE)?.value)}
      vendorUrl={vendorAppUrl()}
      pricingHref="/pricing"
      directoryBase={links.directoryPath('')}
      suffix={base ? `.${base}` : ''}
      subdomain={/^[a-z0-9-]{1,63}$/.test(one(q.subdomain).toLowerCase()) ? one(q.subdomain).toLowerCase() : ''}
    />
  );
}
