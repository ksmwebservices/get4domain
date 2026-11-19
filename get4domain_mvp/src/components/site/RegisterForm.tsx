'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AcceptNotice from '@/components/site/AcceptNotice';
import CategoryPicker from '@/components/site/CategoryPicker';
import { handoffTarget } from '@/lib/v3-public/handoff';
import { billedLine, PER_MONTH, PORTAL } from '@/lib/v3-public/portal-strings';
import { categoriesForTrack, isProPlan, planAfterPick, signInWithNext, vendorSignInUrl, type CatOption, type PlanChoice } from '@/lib/v3-public/register-plan';
import { vendorHost } from '@/lib/v3-public/hostnames';
import { subdomainProblem, validateRegister, type DuplicateAsk, type FieldErrors, type RegisterErrorKey, type RegisterField, type SubdomainState } from '@/lib/v3-public/register';
import { SITE } from '@/lib/v3-public/site-strings';

export type CategoryOption = CatOption;

interface Props {
  categories: CatOption[];
  categoriesFailed: boolean;
  /** the plan the page was opened with: free, or a Pro plan key (handyman, professional, ecommerce) */
  plan: string;
  /** the Pro plans with their prices as text, from the public price route only */
  planChoices: PlanChoice[];
  /** the name of the opened plan when the price list could not be read */
  planNameFallback: string | null;
  term: number | null;
  /** the billing terms the price list offers */
  terms: number[];
  referral: boolean;
  /** a pack key from an industry page (?pack=): the category list starts limited to that pack; null for none */
  pack?: string | null;
  /** a category id from a category page (?category=): chosen when the form opens; null for none */
  category?: string | null;
  packName?: string | null;
  vendorUrl: string | null;
  /** where "Change plan" goes (the pricing page) and where a directory listing lives */
  pricingHref: string;
  directoryBase: string;
  /** the real base domain (NEXT_PUBLIC_SITE_BASE_DOMAIN): the full address is `<name>.<baseDomain>` */
  baseDomain: string;
  subdomain?: string;
}

interface Done { target: string | null; site: 'live' | 'pending'; siteCreated: boolean; held: boolean; host: string }
interface Reply { ok: boolean; fields: FieldErrors; general: RegisterErrorKey | null; handoff: string | null; site?: 'live' | 'pending'; siteCreated?: boolean; duplicate?: DuplicateAsk | null; claimSlug?: string | null }

const INPUT = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';
const R = SITE.register;
const errText = (k: RegisterErrorKey | undefined): string | null => (k ? R.errors[k] : null);
const fill = (t: string, vars: Record<string, string>): string => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), t);
const titleCase = (k: string): string => k.charAt(0).toUpperCase() + k.slice(1);

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error: string | null; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, error: boolean): string | undefined => [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

export default function RegisterForm(p: Props) {
  const [planKey, setPlanKey] = useState(p.plan);
  const [term, setTerm] = useState<number | null>(() => (isProPlan(p.plan) ? (p.term ?? (p.terms.includes(12) ? 12 : p.terms[p.terms.length - 1] ?? null)) : null));
  const [notice, setNotice] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [categoryKey, setCategoryKey] = useState(() => (p.category && p.categories.some((c) => c.key === p.category) ? p.category : ''));
  const [showAll, setShowAll] = useState(false);
  const [onlyPack, setOnlyPack] = useState(true);
  const [subdomain, setSubdomain] = useState(p.subdomain ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<RegisterErrorKey | null>(null);
  const [claimSlug, setClaimSlug] = useState<string | null>(null);
  const [ask, setAsk] = useState<DuplicateAsk | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [availability, setAvailability] = useState<SubdomainState | 'checking' | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const seq = useRef(0);
  const svcSeq = useRef(0);
  const summary = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLElement>(null);

  const pro = isProPlan(planKey);
  const planRow = p.planChoices.find((x) => x.key === planKey) ?? null;
  const planName = planRow?.name ?? (pro ? p.planNameFallback ?? titleCase(planKey) : null);

  // the categories offered: a Pro plan lists only its own track until the visitor asks for all; Free (or the list of a pack) lists everything, grouped by family
  const inPack = useMemo(() => (p.pack ? p.categories.filter((c) => c.packKey === p.pack) : []), [p.pack, p.categories]);
  const trackList = useMemo(() => (planRow ? categoriesForTrack(p.categories, planRow.track) : []), [planRow, p.categories]);
  const trackLimited = pro && !!planRow && !showAll && trackList.length > 0;
  const packLimited = !pro && onlyPack && inPack.length > 0;
  const offered = trackLimited ? trackList : packLimited ? inPack : p.categories;
  const pickerNote = trackLimited && planName ? fill(R.pro.trackOnly, { plan: planName }) : packLimited ? fill(R.packLimited, { name: p.packName ?? '' }) : null;

  // live availability: the local rules answer at once; the server is asked once the visitor pauses
  useEffect(() => {
    const s = subdomain.trim().toLowerCase();
    if (!s) { setAvailability(null); return; }
    const local = subdomainProblem(s);
    if (local && local !== 'subdomainReserved') { setAvailability(null); return; }
    const mine = ++seq.current;
    setAvailability('checking');
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/directory-api/subdomain?slug=${encodeURIComponent(s)}`, { cache: 'no-store' });
        const j = (await r.json()) as { state?: SubdomainState };
        if (mine === seq.current) setAvailability(j.state ?? 'unknown');
      } catch {
        if (mine === seq.current) setAvailability('unknown');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [subdomain]);

  // the chosen category's starter services (the only finer data the API has); shown as chips, never sent with the signup
  useEffect(() => {
    if (!categoryKey) { setServices([]); return; }
    const mine = ++svcSeq.current;
    fetch(`/directory-api/category-services?key=${encodeURIComponent(categoryKey)}`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ services?: string[] }>)
      .then((j) => { if (mine === svcSeq.current) setServices(Array.isArray(j.services) ? j.services : []); })
      .catch(() => { if (mine === svcSeq.current) setServices([]); });
  }, [categoryKey]);

  const addressMessage = ((): { text: string; bad: boolean } | null => {
    if (errors.subdomain) return { text: R.errors[errors.subdomain], bad: true };
    if (availability === 'checking') return { text: R.checking, bad: false };
    if (availability === 'available') return { text: R.available, bad: false };
    if (availability === 'taken') return { text: R.errors.subdomainTaken, bad: true };
    if (availability === 'reserved') return { text: R.errors.subdomainReserved, bad: true };
    if (availability === 'unknown') return { text: R.notChecked, bad: false };
    return null;
  })();

  function pick(c: CatOption): void {
    setCategoryKey(c.key);
    setAsk(null);
    if (!pro) return;
    // a category from another track moves the visitor to that track's plan, and says so
    const r = planAfterPick(p.planChoices, planKey, c);
    if (r.switched && r.plan && planRow) {
      setPlanKey(r.plan.key);
      setNotice(fill(R.pro.switchedNotice, { category: c.name, from: planRow.name, to: r.plan.name }));
    } else {
      setNotice(null);
    }
  }

  async function submit(e: React.FormEvent | null, confirmDistinct = false): Promise<void> {
    e?.preventDefault();
    setGeneral(null);
    setClaimSlug(null);
    const cat = p.categories.find((c) => c.key === categoryKey);
    // the category is sent as its id from the list; if the id is not in the list nothing is sent
    const input = { businessName, categoryKey: cat ? categoryKey : '', industry: '', subdomain, name, email, phone, password, acceptedTerms: accepted, plan: planKey, termMonths: pro ? term : null, city, area, pincode, gstin, confirmDistinct };
    const found = validateRegister(input);
    if (availability === 'taken' && !found.subdomain) found.subdomain = 'subdomainTaken';
    setErrors(found);
    if (Object.keys(found).length) { setAsk(null); summary.current?.focus(); return; }
    setBusy(true);
    let r: Reply;
    try {
      const res = await fetch('/directory-api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      r = (await res.json()) as Reply;
    } catch {
      r = { ok: false, fields: {}, general: 'notAvailable', handoff: null, site: 'pending', siteCreated: false, duplicate: null, claimSlug: null };
    }
    setBusy(false);
    if (r.duplicate) {
      // "Is this your business?": the form keeps what was typed (the password too) so a "No, a different business" answer can send it again
      setAsk(r.duplicate);
      setErrors({});
      setTimeout(() => askRef.current?.focus(), 0);
      return;
    }
    setAsk(null);
    setPassword('');
    if (r.ok) {
      const site = r.site === 'live' ? 'live' : 'pending';
      const target = handoffTarget(p.vendorUrl, r.handoff);
      setDone({ target, site, siteCreated: r.siteCreated === true || site === 'live', held: confirmDistinct, host: vendorHost(subdomain, p.baseDomain) });
      // no automatic jump: the person is shown the result and the sign-in link; nothing is claimed as live or paid
      return;
    }
    setErrors(r.fields ?? {});
    setClaimSlug(r.claimSlug ?? null);
    setGeneral(r.general ?? (Object.keys(r.fields ?? {}).length ? null : 'general'));
    summary.current?.focus();
  }

  if (done) {
    if (pro) {
      const next = signInWithNext(p.vendorUrl, planKey, term);
      return (
        <section aria-labelledby="done-title" role="status" className="max-w-xl">
          <h1 id="done-title" className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{R.done.proTitle}</h1>
          <p className="mt-3 text-slate-700">{R.done.proBody}</p>
          {done.siteCreated ? <p className="mt-2 text-slate-700">{R.done.proSiteCreated}{done.site === 'live' ? '' : done.held ? ` ${R.done.proSiteHeld}` : ''}</p> : null}
          {next ? <a href={next} className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">{R.done.proCta}</a> : <p className="mt-4 text-slate-600">{R.done.proNoApp}</p>}
          <p className="mt-4 text-sm"><Link href="/login" className="text-slate-900 underline">{R.done.pendingSignIn}</Link></p>
        </section>
      );
    }
    const signIn = vendorSignInUrl(p.vendorUrl);
    return (
      <section aria-labelledby="done-title" role="status" className="max-w-xl">
        <h1 id="done-title" className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{R.done.creatingTitle}</h1>
        <p className="mt-3 text-slate-700">{fill(R.done.creatingBody, { host: done.host })}{done.held ? ` ${R.duplicate.distinctNote}` : ''}</p>
        <p className="mt-3 break-all text-base font-semibold text-ink-900" data-testid="done-host">{done.host}</p>
        {signIn ? <a href={signIn} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{R.done.creatingCta}</a> : <p className="mt-3 text-slate-600">{R.done.noApp}</p>}
        <p className="mt-3 text-sm"><Link href="/login" className="text-slate-900 underline">{R.done.pendingSignIn}</Link></p>
      </section>
    );
  }

  const fieldKeys = Object.keys(errors) as RegisterField[];
  const err = (f: RegisterField): string | null => errText(errors[f]);
  const H = PORTAL.home;
  const termRow = pro && term !== null ? { monthly: planRow?.monthly[term] ?? null, total: planRow?.total[term] ?? null } : null;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="register-title" className="max-w-xl">
      {pro && planName ? (
        <>
          <h1 id="register-title" className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{fill(R.pro.title, { plan: planName })}</h1>
          <p className="mb-6 mt-2 text-slate-600">{R.pro.intro}</p>
        </>
      ) : (
        <>
          <h1 id="register-title" className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{R.h1}</h1>
          <p className="mb-6 mt-2 text-slate-600">{R.intro}</p>
        </>
      )}

      {pro && planName ? (
        <section aria-labelledby="plan-summary-title" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 id="plan-summary-title" className="text-sm font-semibold text-ink-900">{R.pro.summaryHeading}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">{R.pro.planLabel}</dt>
              <dd className="text-base font-semibold text-ink-900" data-testid="summary-plan">{planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500"><label htmlFor="summary-term">{R.pro.termLabel}</label></dt>
              <dd>
                <select id="summary-term" value={term ?? ''} onChange={(e) => setTerm(Number(e.target.value) || null)} className="mt-0.5 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                  {[...p.terms].sort((a, b) => b - a).map((t) => <option key={t} value={t}>{H.terms[t] ?? t}</option>)}
                </select>
              </dd>
            </div>
          </dl>
          <div className="mt-3" aria-live="polite">
            {termRow && termRow.monthly && termRow.total ? (
              <>
                <p className="text-xs text-slate-500">{R.pro.monthlyLabel}</p>
                <p className="text-3xl font-bold text-ink-900" data-testid="summary-monthly">{termRow.monthly}<span className="ml-1 text-sm font-normal text-slate-600">{PER_MONTH}</span></p>
                <p className="mt-1 text-sm text-slate-600" data-testid="summary-billed">{billedLine(term as number, termRow.total)}</p>
              </>
            ) : <p className="text-sm font-medium text-slate-600">{planRow && !planRow.pending ? R.pro.notOffered : R.pro.priceNotSet}</p>}
          </div>
          <p className="mt-3 text-sm"><Link href={p.pricingHref} className="font-medium text-slate-900 underline">{R.pro.changePlan}</Link></p>
          {notice ? <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="plan-switched">{notice}</p> : null}
        </section>
      ) : null}

      <div ref={summary} tabIndex={-1} aria-live="assertive">
        {general ? (
          <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {R.errors[general]}
            {claimSlug ? <> <a href={`${p.directoryBase}/business/${claimSlug}`} className="font-medium underline">{R.duplicate.view}</a></> : null}
          </p>
        ) : null}
        {fieldKeys.length > 0 && !general ? <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{R.errors.fieldsSummary}</p> : null}
      </div>
      {!pro ? (
        <p className="mb-4 text-sm text-slate-700">
          <span className="font-medium">{R.planNote}:</span> {R.freePlan}
          {p.referral ? <span className="ml-2 text-slate-500">{R.referralNote}</span> : null}
        </p>
      ) : p.referral ? <p className="mb-4 text-sm text-slate-500">{R.referralNote}</p> : null}

      <Field id="businessName" label={R.labels.businessName} error={err('businessName')}>
        <input id="businessName" name="businessName" autoComplete="organization" value={businessName} onChange={(e) => { setBusinessName(e.target.value); setAsk(null); }} aria-invalid={!!errors.businessName} aria-describedby={describedBy('businessName', false, !!errors.businessName)} className={INPUT} />
      </Field>

      <Field id="category" label={R.labels.category} hint={p.categoriesFailed ? undefined : R.hints.category} error={err('category') ?? (p.categoriesFailed ? R.categoriesError : null)}>
        <CategoryPicker
          id="category"
          options={offered}
          value={categoryKey}
          onPick={pick}
          invalid={!!errors.category}
          describedBy={describedBy('category', !p.categoriesFailed, !!errors.category || p.categoriesFailed)}
          note={pickerNote}
          footer={
            trackLimited ? <button type="button" onClick={() => setShowAll(true)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">{R.picker.notHere}</button>
              : pro && showAll && trackList.length > 0 ? <button type="button" onClick={() => setShowAll(false)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">{R.picker.backToTrack}</button>
              : packLimited ? <button type="button" onClick={() => setOnlyPack(false)} className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">{R.packShowAll}</button>
              : null
          }
        />
        {categoryKey && services.length > 0 ? (
          <div className="mt-3" data-testid="category-services">
            <p className="text-xs font-semibold text-slate-700">{R.subHeading}</p>
            <ul className="mt-1 flex flex-wrap gap-2">{services.map((x) => <li key={x} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-800">{x}</li>)}</ul>
            <p className="mt-1 text-xs text-slate-500">{R.subNote}</p>
          </div>
        ) : null}
        {p.categories.length === 0 && !p.categoriesFailed ? <p className="mt-1 text-sm text-slate-600" role="status">{R.noCategories}</p> : null}
      </Field>

      <Field id="city" label={R.labels.city} hint={R.hints.city} error={err('city')}>
        <input id="city" name="city" autoComplete="address-level2" value={city} onChange={(e) => { setCity(e.target.value); setAsk(null); }} aria-invalid={!!errors.city} aria-describedby={describedBy('city', true, !!errors.city)} className={INPUT} />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field id="area" label={R.labels.area} hint={R.hints.area} error={err('area')}>
          <input id="area" name="area" autoComplete="address-level3" value={area} onChange={(e) => { setArea(e.target.value); setAsk(null); }} aria-invalid={!!errors.area} aria-describedby={describedBy('area', true, !!errors.area)} className={INPUT} />
        </Field>
        <Field id="pincode" label={R.labels.pincode} hint={R.hints.pincode} error={err('pincode')}>
          <input id="pincode" name="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={pincode} onChange={(e) => { setPincode(e.target.value.replace(/[^0-9]/g, '')); setAsk(null); }} aria-invalid={!!errors.pincode} aria-describedby={describedBy('pincode', true, !!errors.pincode)} className={INPUT} />
        </Field>
      </div>
      <Field id="gstin" label={R.labels.gstin} hint={R.hints.gstin} error={err('gstin')}>
        <input id="gstin" name="gstin" autoCapitalize="characters" autoComplete="off" maxLength={20} value={gstin} onChange={(e) => { setGstin(e.target.value.toUpperCase()); setAsk(null); }} aria-invalid={!!errors.gstin} aria-describedby={describedBy('gstin', true, !!errors.gstin)} className={INPUT} />
      </Field>

      <Field id="subdomain" label={R.labels.subdomain} hint={pro ? R.hints.subdomainPro : R.hints.subdomain} error={null}>
        <div className="flex items-center gap-1">
          <input id="subdomain" name="subdomain" autoComplete="off" autoCapitalize="none" spellCheck={false} value={subdomain} onChange={(e) => setSubdomain(e.target.value)} aria-invalid={addressMessage?.bad === true} aria-describedby={describedBy('subdomain', true, false) + ' subdomain-status'} className={INPUT} />
          <span className="mt-1 whitespace-nowrap text-sm text-slate-600" data-testid="address-suffix">.{p.baseDomain}</span>
        </div>
        <p className="mt-1 break-all text-sm font-medium text-slate-900" data-testid="address-full">{subdomain.trim() ? fill(R.addressPreview, { host: vendorHost(subdomain, p.baseDomain) }) : R.addressEmpty}</p>
        <p id="subdomain-status" role="status" aria-live="polite" className={`mt-1 text-sm ${addressMessage?.bad ? 'text-red-700' : 'text-slate-600'}`}>{addressMessage?.text ?? ''}</p>
      </Field>

      <Field id="name" label={R.labels.owner} error={err('owner')}>
        <input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.owner} aria-describedby={describedBy('name', false, !!errors.owner)} className={INPUT} />
      </Field>
      <Field id="email" label={R.labels.email} error={err('email')}>
        <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={describedBy('email', false, !!errors.email)} className={INPUT} />
      </Field>
      <Field id="phone" label={R.labels.phone} hint={R.hints.phone} error={err('phone')}>
        <input id="phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby={describedBy('phone', true, !!errors.phone)} className={INPUT} />
      </Field>
      <Field id="password" label={R.labels.password} hint={R.hints.password} error={err('password')}>
        <input id="password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={describedBy('password', true, !!errors.password)} className={INPUT} />
      </Field>

      <div className="mb-4">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input id="terms" name="terms" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} aria-invalid={!!errors.terms} aria-describedby={errors.terms ? 'terms-error' : undefined} className="mt-1" />
          <span>{R.labels.terms}</span>
        </label>
        <p className="ml-6 mt-1 text-xs"><Link href="/terms" className="text-slate-700 underline">{R.termsLinkText}</Link> <Link href="/privacy-policy" className="ml-3 text-slate-700 underline">{R.privacyLinkText}</Link></p>
        <AcceptNotice className="ml-6 mt-2 text-xs text-slate-600" />
        {errors.terms ? <p id="terms-error" role="alert" className="ml-6 mt-1 text-sm text-red-700">{R.errors.terms}</p> : null}
      </div>

      {ask ? (
        <section ref={askRef} tabIndex={-1} aria-labelledby="dup-title" className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4" data-testid="is-this-yours">
          <h2 id="dup-title" className="text-base font-semibold text-amber-950">{R.duplicate.title}</h2>
          <p className="mt-1 text-sm text-amber-900">{R.duplicate.body}</p>
          <ul className="mt-3 space-y-2">
            {ask.candidates.map((c) => (
              <li key={c.slug} className="rounded-lg bg-white p-3 text-sm text-slate-800">
                <p className="font-semibold">{c.name}</p>
                <p className="text-slate-600">{[c.category, c.area, c.city].filter(Boolean).join(', ')}</p>
                <a href={`${p.directoryBase}/business/${c.slug}`} className="mt-1 inline-block font-medium text-slate-900 underline">{c.claimable ? R.duplicate.claim : R.duplicate.view}</a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-amber-900">{R.duplicate.distinctNote}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void submit(null, true)} className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{R.duplicate.distinct}</button>
            <button type="button" onClick={() => setAsk(null)} className="min-h-[44px] rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-900">{R.duplicate.edit}</button>
          </div>
        </section>
      ) : null}

      {!ask && !categoryKey ? <p id="submit-why" data-testid="category-why" className="mb-2 text-sm text-slate-700">{R.categoryWhy}</p> : null}
      {busy ? <p role="status" data-testid="creating" className="mb-2 break-all text-sm text-slate-700">{R.creating}{!pro && subdomain.trim() ? ` ${vendorHost(subdomain, p.baseDomain)}` : ''}</p> : null}
      {!ask ? <button type="submit" disabled={busy || !categoryKey} aria-describedby={!categoryKey ? 'submit-why' : undefined} className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? R.submitting : pro ? R.pro.submit : R.submit}</button> : null}
      <p className="mt-4 text-sm text-slate-600">{R.haveAccount} <Link href="/login" className="text-slate-900 underline">{R.signIn}</Link></p>
    </form>
  );
}
