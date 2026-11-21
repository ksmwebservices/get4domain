'use client';

import { useState } from 'react';
import { ApprovalScreen, MailOffScreen } from '@/components/directory/ClaimScreens';
import { codeOk, emailOk, passwordOk } from '@/lib/v3-public/claim';
import { handoffCodeOk, handoffTarget } from '@/lib/v3-public/handoff';
import { messageForCode, S } from '@/lib/v3-public/strings';
import type { ClaimCallResult } from '@/lib/v3-public/types';

type Step = 'request' | 'verify' | 'account' | 'approval';
const ORDER: Step[] = ['request', 'verify', 'account', 'approval'];
const LABEL: Record<Step, string> = { request: S.claim.steps.code, verify: S.claim.steps.verify, account: S.claim.steps.account, approval: S.claim.steps.approval };

async function call(action: string, body: Record<string, unknown>): Promise<ClaimCallResult> {
  try {
    const res = await fetch(`/directory-api/claim/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status, code: null, message: null, data: null };
    return (await res.json()) as ClaimCallResult;
  } catch {
    return { ok: false, status: 0, code: null, message: null, data: null };
  }
}

/** The text of a failed call: network trouble, a rate limit (the API's own sentence when it sent one), or the plain message of a registered code. */
function failure(r: ClaimCallResult): string {
  if (r.status === 0) return S.errors.network;
  if (r.status === 429) return r.message || S.errors.rateLimited;
  return messageForCode(r.code, r.status);
}

/**
 * The steps after the claim link: get the code by email, enter it, set up the account (password, terms, and a login email when the business has none),
 * then approval, which happens in the business app. The browser only ever talks to this site.
 */
export default function ClaimWizard({ token, businessName, vendorUrl }: { token: string; businessName: string; vendorUrl: string | null }) {
  const [step, setStep] = useState<Step>('request');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mailOff, setMailOff] = useState(false);
  const [code, setCode] = useState('');
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [needEmail, setNeedEmail] = useState(false);
  const [terms, setTerms] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  const idx = ORDER.indexOf(step);

  async function requestCode(): Promise<void> {
    setBusy(true); setError(null); setInfo(null);
    const r = await call('otp-request', { token });
    setBusy(false);
    if (r.ok) { setInfo(S.claim.request.sent); setStep('verify'); return; }
    if (r.code === 'MAIL_DISABLED') { setMailOff(true); return; }
    setError(failure(r));
  }

  async function verify(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!codeOk(code)) { setError(S.errors.codeFormat); return; }
    setBusy(true);
    const r = await call('otp-verify', { token, code });
    setBusy(false);
    const st = (r.data as { setupToken?: string } | null)?.setupToken;
    if (r.ok && st) { setSetupToken(st); setInfo(null); setStep('account'); return; }
    setError(failure(r));
  }

  async function setup(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!passwordOk(password)) { setError(S.errors.passwordShort); return; }
    if (needEmail && !emailOk(email)) { setError(S.errors.emailInvalid); return; }
    if (!terms) { setError(messageForCode('CLAIM_TERMS_REQUIRED')); return; }
    setBusy(true);
    const r = await call('setup', { setupToken, password, acceptTerms: terms, ...(email ? { email } : {}) });
    setBusy(false);
    if (r.ok) {
      const handoff = (r.data as { handoff?: unknown } | null)?.handoff;
      setTarget(handoffTarget(vendorUrl, handoffCodeOk(handoff) ? handoff : null));
      setPassword('');
      setStep('approval');
      return;
    }
    if (r.code === 'CLAIM_EMAIL_REQUIRED') setNeedEmail(true);
    setError(failure(r));
  }

  if (mailOff) return <MailOffScreen />;
  if (step === 'approval') return <ApprovalScreen vendorUrl={vendorUrl} href={target} follow />;

  return (
    <div>
      <ol aria-label={S.claim.stepsLabel} className="mb-6 flex flex-wrap gap-2 text-sm">
        {ORDER.slice(0, 3).map((s, i) => (
          <li key={s} aria-current={i === idx ? 'step' : undefined} className={`rounded-full px-3 py-1 ${i === idx ? 'bg-slate-900 text-white' : i < idx ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>
            {LABEL[s]}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{S.claim.wizard.stepOf(idx + 1, 3)}</p>

      {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
      {info && <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">{info}</p>}

      {step === 'request' && (
        <section aria-labelledby="req-title">
          <h2 id="req-title" className="text-xl font-semibold text-slate-900">{S.claim.request.title}</h2>
          <p className="mt-2 text-sm text-slate-700">{S.claim.request.body(businessName)}</p>
          <button type="button" onClick={requestCode} disabled={busy} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? S.claim.wizard.working : S.claim.request.send}
          </button>
        </section>
      )}

      {step === 'verify' && (
        <form onSubmit={verify} aria-labelledby="ver-title" noValidate>
          <h2 id="ver-title" className="text-xl font-semibold text-slate-900">{S.claim.verify.title}</h2>
          <label htmlFor="code" className="mt-3 block text-sm font-medium text-slate-900">{S.claim.verify.codeLabel}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-describedby="code-hint" className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 tracking-widest" />
          <p id="code-hint" className="mt-1 text-xs text-slate-500">{S.claim.verify.codeHint}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? S.claim.wizard.working : S.claim.verify.submit}</button>
            <button type="button" onClick={requestCode} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 disabled:opacity-60">{S.claim.verify.resend}</button>
          </div>
        </form>
      )}

      {step === 'account' && (
        <form onSubmit={setup} aria-labelledby="acc-title" noValidate>
          <h2 id="acc-title" className="text-xl font-semibold text-slate-900">{S.claim.account.title}</h2>
          {needEmail && (
            <div className="mt-3">
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-900">{S.claim.account.emailLabel}</label>
              <input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="email-hint" className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2" />
              <p id="email-hint" className="mt-1 text-xs text-slate-500">{S.claim.account.emailHint}</p>
            </div>
          )}
          <div className="mt-3">
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-900">{S.claim.account.passwordLabel}</label>
            <input id="new-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2" />
            <p id="pw-hint" className="mt-1 text-xs text-slate-500">{S.claim.account.passwordHint}</p>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <input id="terms" name="terms" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1" />
            <label htmlFor="terms" className="text-sm text-slate-800">{S.claim.account.termsLabel}</label>
          </div>
          <button type="submit" disabled={busy} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? S.claim.wizard.working : S.claim.account.submit}</button>
        </form>
      )}
    </div>
  );
}
