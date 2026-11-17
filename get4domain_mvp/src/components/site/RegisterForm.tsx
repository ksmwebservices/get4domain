'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { handoffTarget } from '@/lib/v3-public/handoff';
import { subdomainProblem, validateRegister, type FieldErrors, type RegisterErrorKey, type RegisterField, type SubdomainState } from '@/lib/v3-public/register';
import { SITE } from '@/lib/v3-public/site-strings';

export interface CategoryOption { key: string; name: string; industry: string; packKey?: string }

interface Props {
  categories: CategoryOption[];
  categoriesFailed: boolean;
  plan: string;
  planName: string | null;
  term: number | null;
  termName: string | null;
  referral: boolean;
  /** a pack key from an industry page (?pack=): the category list starts limited to that pack; null for none */
  pack?: string | null;
  packName?: string | null;
  vendorUrl: string | null;
  /** ".main-domain" shown after the address box; empty when the main host is not set */
  suffix: string;
}

const INPUT = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';
const R = SITE.register;
const errText = (k: RegisterErrorKey | undefined): string | null => (k ? R.errors[k] : null);

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
  const [businessName, setBusinessName] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [filter, setFilter] = useState('');
  const inPack = useMemo(() => (p.pack ? p.categories.filter((c) => c.packKey === p.pack) : []), [p.pack, p.categories]);
  const [onlyPack, setOnlyPack] = useState(true);
  const limited = onlyPack && inPack.length > 0;
  const [subdomain, setSubdomain] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<RegisterErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ target: string | null } | null>(null);
  const [availability, setAvailability] = useState<SubdomainState | 'checking' | null>(null);
  const seq = useRef(0);
  const summary = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const base = limited ? inPack : p.categories;
    return f ? base.filter((c) => c.name.toLowerCase().includes(f)) : base;
  }, [filter, p.categories, limited, inPack]);

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

  const addressMessage = ((): { text: string; bad: boolean } | null => {
    if (errors.subdomain) return { text: R.errors[errors.subdomain], bad: true };
    if (availability === 'checking') return { text: R.checking, bad: false };
    if (availability === 'available') return { text: R.available, bad: false };
    if (availability === 'taken') return { text: R.errors.subdomainTaken, bad: true };
    if (availability === 'reserved') return { text: R.errors.subdomainReserved, bad: true };
    if (availability === 'unknown') return { text: R.notChecked, bad: false };
    return null;
  })();

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setGeneral(null);
    const cat = p.categories.find((c) => c.key === categoryKey);
    const found = validateRegister({ businessName, categoryKey, industry: cat?.industry ?? '', subdomain, name, email, phone, password, acceptedTerms: accepted, plan: p.plan, termMonths: p.term });
    if (availability === 'taken' && !found.subdomain) found.subdomain = 'subdomainTaken';
    setErrors(found);
    if (Object.keys(found).length) { summary.current?.focus(); return; }
    setBusy(true);
    let r: { ok: boolean; fields: FieldErrors; general: RegisterErrorKey | null; handoff: string | null };
    try {
      const res = await fetch('/directory-api/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessName, categoryKey, industry: cat?.industry ?? '', subdomain, name, email, phone, password, acceptedTerms: accepted, plan: p.plan, termMonths: p.term }),
      });
      r = (await res.json()) as typeof r;
    } catch {
      r = { ok: false, fields: {}, general: 'notAvailable', handoff: null };
    }
    setBusy(false);
    setPassword('');
    if (r.ok) {
      const target = handoffTarget(p.vendorUrl, r.handoff);
      setDone({ target });
      if (target) window.location.assign(target);
      return;
    }
    setErrors(r.fields ?? {});
    setGeneral(r.general ?? (Object.keys(r.fields ?? {}).length ? null : 'general'));
    summary.current?.focus();
  }

  if (done) {
    return (
      <section aria-labelledby="done-title" role="status">
        <h2 id="done-title" className="text-xl font-semibold text-slate-900">{R.done.title}</h2>
        <p className="mt-2 text-slate-700">{R.done.body}</p>
        {done.target ? <a href={done.target} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{R.done.cta}</a> : <p className="mt-3 text-slate-600">{R.done.noApp}</p>}
      </section>
    );
  }

  const fieldKeys = Object.keys(errors) as RegisterField[];
  const err = (f: RegisterField): string | null => errText(errors[f]);
  return (
    <form onSubmit={submit} noValidate aria-labelledby="register-title">
      <h2 id="register-title" className="sr-only">{R.title}</h2>
      <div ref={summary} tabIndex={-1} aria-live="assertive">
        {general ? <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{R.errors[general]}</p> : null}
        {fieldKeys.length > 0 && !general ? <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{R.errors.general}</p> : null}
      </div>
      <p className="mb-4 text-sm text-slate-700">
        <span className="font-medium">{R.planNote}:</span> {p.planName ?? R.freePlan}{p.termName ? `, ${p.termName}` : ''}
        {p.referral ? <span className="ml-2 text-slate-500">{R.referralNote}</span> : null}
      </p>

      <Field id="businessName" label={R.labels.businessName} error={err('businessName')}>
        <input id="businessName" name="businessName" autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} aria-invalid={!!errors.businessName} aria-describedby={describedBy('businessName', false, !!errors.businessName)} className={INPUT} />
      </Field>

      <Field id="categorySearch" label={R.labels.category} hint={p.categoriesFailed ? undefined : R.hints.category} error={err('category') ?? (p.categoriesFailed ? R.categoriesError : null)}>
        <input id="categorySearch" type="search" placeholder={R.labels.categorySearch} value={filter} onChange={(e) => setFilter(e.target.value)} aria-describedby={describedBy('categorySearch', !p.categoriesFailed, !!errors.category || p.categoriesFailed)} className={INPUT} />
        <select id="category" aria-label={R.labels.category} size={6} value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)} aria-invalid={!!errors.category} className={`${INPUT} mt-2`}>
          {shown.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
        </select>
        {limited ? (
          <p className="mt-1 text-sm text-slate-600">{R.packLimited.replace('{name}', p.packName ?? '')} <button type="button" onClick={() => setOnlyPack(false)} className="font-medium text-slate-900 underline">{R.packShowAll}</button></p>
        ) : null}
        {shown.length === 0 && !p.categoriesFailed ? <p className="mt-1 text-sm text-slate-600" role="status">{R.noCategories}</p> : null}
      </Field>

      <Field id="subdomain" label={R.labels.subdomain} hint={R.hints.subdomain} error={null}>
        <div className="flex items-center gap-1">
          <input id="subdomain" name="subdomain" autoComplete="off" autoCapitalize="none" spellCheck={false} value={subdomain} onChange={(e) => setSubdomain(e.target.value)} aria-invalid={addressMessage?.bad === true} aria-describedby={describedBy('subdomain', true, false) + ' subdomain-status'} className={INPUT} />
          {p.suffix ? <span className="mt-1 whitespace-nowrap text-sm text-slate-600">{p.suffix}</span> : null}
        </div>
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
        <p className="ml-6 mt-1 text-xs"><Link href="/legal/terms" className="text-slate-700 underline">{R.termsLinkText}</Link> <Link href="/legal/privacy" className="ml-3 text-slate-700 underline">{R.privacyLinkText}</Link></p>
        {errors.terms ? <p id="terms-error" role="alert" className="ml-6 mt-1 text-sm text-red-700">{R.errors.terms}</p> : null}
      </div>

      <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? R.submitting : R.submit}</button>
      <p className="mt-4 text-sm text-slate-600">{R.haveAccount} <Link href="/login" className="text-slate-900 underline">{R.signIn}</Link></p>
    </form>
  );
}
