'use client';

import Link from 'next/link';
import { useState } from 'react';
import { emailOk } from '@/lib/v3-public/claim';
import { S } from '@/lib/v3-public/strings';
import type { ClaimCallResult } from '@/lib/v3-public/types';

async function call(action: string, body: Record<string, unknown>): Promise<ClaimCallResult> {
  try {
    const res = await fetch(`/directory-api/auth/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, code: null, message: null, data: null };
    return (await res.json()) as ClaimCallResult;
  } catch {
    return { ok: false, status: 0, code: null, message: null, data: null };
  }
}

const strong = (p: string): boolean => p.length >= 8 && p.length <= 128 && /[A-Z]/.test(p) && /\d/.test(p);

function Alert({ text }: { text: string | null }) {
  return text ? <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{text}</p> : null;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-sm font-medium text-slate-900">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const INPUT = 'mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2';
const BUTTON = 'mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60';

/** After a successful step the visitor continues to the business app (its address comes from the environment). */
function Done({ text, vendorUrl }: { text: string; vendorUrl: string | null }) {
  return (
    <section role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-6">
      <p className="font-medium text-slate-900">{text}</p>
      <p className="mt-3 text-sm">
        {vendorUrl ? <a href={vendorUrl} rel="noopener" className="inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">{S.auth.continueTo}</a> : <span className="text-slate-600">{S.auth.notAvailableBody}</span>}
      </p>
    </section>
  );
}

function failureText(r: ClaimCallResult, fallback: string): string {
  if (r.status === 0) return S.errors.network;
  if (r.status === 429) return r.message || S.errors.rateLimited;
  return fallback;
}

export function LoginForm({ vendorUrl }: { vendorUrl: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!emailOk(email)) { setError(S.errors.emailInvalid); return; }
    if (!password) { setError(S.auth.errors.passwordMissing); return; }
    setBusy(true);
    const r = await call('login', { email, password });
    setBusy(false);
    setPassword('');
    if (r.ok) { setDone(true); return; }
    setError(failureText(r, r.status === 401 ? S.auth.errors.badCredentials : S.auth.errors.fieldsInvalid));
  }

  if (done) return <Done text={S.auth.signedIn} vendorUrl={vendorUrl} />;
  return (
    <form onSubmit={submit} noValidate aria-labelledby="login-title">
      <h2 id="login-title" className="sr-only">{S.auth.login.title}</h2>
      <Alert text={error} />
      <Field id="email" label={S.auth.login.emailLabel}>
        <input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </Field>
      <Field id="password" label={S.auth.login.passwordLabel}>
        <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
      </Field>
      <button type="submit" disabled={busy} className={BUTTON}>{busy ? S.auth.working : S.auth.login.submit}</button>
      <p className="mt-4 text-sm"><Link href="/account/forgot-password" className="text-primary-700 hover:underline">{S.auth.login.forgot}</Link></p>
      <p className="mt-2 text-sm text-slate-600">{S.auth.login.noAccount} <Link href="/account/register" className="text-primary-700 hover:underline">{S.auth.login.createAccount}</Link></p>
      <p className="mt-4 text-xs text-slate-500">{S.auth.handoffNote}</p>
    </form>
  );
}

export function RegisterForm({ vendorUrl, industries }: { vendorUrl: string | null; industries: Array<{ id: string; name: string }> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError(S.auth.errors.nameRequired); return; }
    if (!emailOk(email)) { setError(S.errors.emailInvalid); return; }
    if (!strong(password)) { setError(S.auth.errors.passwordWeak); return; }
    if (!businessName.trim()) { setError(S.auth.errors.businessRequired); return; }
    if (!industry) { setError(S.auth.errors.industryRequired); return; }
    setBusy(true);
    const r = await call('register', { name, email, password, businessName, industry });
    setBusy(false);
    setPassword('');
    if (r.ok) { setDone(true); return; }
    setError(failureText(r, r.status === 409 ? S.auth.errors.emailTaken : S.auth.errors.fieldsInvalid));
  }

  if (done) return <Done text={S.auth.registered} vendorUrl={vendorUrl} />;
  return (
    <form onSubmit={submit} noValidate aria-labelledby="register-title">
      <h2 id="register-title" className="sr-only">{S.auth.register.title}</h2>
      <Alert text={error} />
      <Field id="name" label={S.auth.fields.name}>
        <input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
      </Field>
      <Field id="reg-email" label={S.auth.login.emailLabel}>
        <input id="reg-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </Field>
      <Field id="reg-password" label={S.auth.login.passwordLabel} hint={S.auth.fields.passwordRules}>
        <input id="reg-password" name="password" type="password" autoComplete="new-password" aria-describedby="reg-password-hint" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
      </Field>
      <Field id="business" label={S.auth.fields.business}>
        <input id="business" name="businessName" autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={INPUT} />
      </Field>
      <Field id="industry" label={S.auth.fields.industry}>
        <select id="industry" name="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className={INPUT}>
          <option value="">{S.auth.fields.industryPlaceholder}</option>
          {industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </Field>
      <button type="submit" disabled={busy} className={BUTTON}>{busy ? S.auth.working : S.auth.register.submit}</button>
      <p className="mt-4 text-sm text-slate-600">{S.auth.register.haveAccount} <Link href="/account/login" className="text-primary-700 hover:underline">{S.auth.register.signIn}</Link></p>
      <p className="mt-4 text-xs text-slate-500">{S.auth.handoffNote}</p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!emailOk(email)) { setError(S.errors.emailInvalid); return; }
    setBusy(true);
    const r = await call('forgot', { email });
    setBusy(false);
    if (r.ok) { setSent(true); return; }
    setError(failureText(r, S.errors.generic));
  }

  if (sent) {
    return (
      <section role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm text-slate-800">{S.auth.forgot.sent}</p>
        <p className="mt-3 text-sm"><Link href="/account/login" className="text-primary-700 hover:underline">{S.auth.forgot.back}</Link></p>
      </section>
    );
  }
  return (
    <form onSubmit={submit} noValidate aria-labelledby="forgot-title">
      <h2 id="forgot-title" className="sr-only">{S.auth.forgot.title}</h2>
      <Alert text={error} />
      <Field id="forgot-email" label={S.auth.forgot.emailLabel}>
        <input id="forgot-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
      </Field>
      <button type="submit" disabled={busy} className={BUTTON}>{busy ? S.auth.working : S.auth.forgot.submit}</button>
      <p className="mt-4 text-sm"><Link href="/account/login" className="text-primary-700 hover:underline">{S.auth.forgot.back}</Link></p>
    </form>
  );
}
