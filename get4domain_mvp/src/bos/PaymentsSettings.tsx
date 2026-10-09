'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, CreditCard, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { bos, plain, useLoad } from './client';
import { Alert, Field, inputCls } from './ui';

type Mode = 'ORDER_REQUEST' | 'ONLINE';
interface Cfg { razorpayKeyId: string | null; enabled: boolean; hasSecret: boolean; checkoutMode: Mode | null; mode: 'test' | 'live' | null; keyIdInvalid: boolean }
interface Settings { upiId: string | null; bankDetails: string | null }

/** Same rule the server enforces. The Key ID is NEVER taken from any other field (Bug B2: a browser used to put the login e-mail here). */
export const RAZORPAY_KEY_PATTERN = /^rzp_(test|live)_[A-Za-z0-9]{6,40}$/;

/**
 * Collect payments. Everything here is the vendor's OWN money: their own Razorpay account for the website, and their own UPI / bank details for
 * collecting by hand. Get4Domain's Razorpay is only ever used for what the vendor pays Get4Domain (see Plan and billing).
 */
export default function PaymentsSettings() {
  const cfgLoad = useLoad(() => bos<Cfg>('/vendor-payments'), []);
  const setLoad = useLoad(() => bos<Settings>('/bos/settings'), []);
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [upi, setUpi] = useState('');
  const [bank, setBank] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const c = cfgLoad.data;
    if (!c) return;
    setKeyId(c.razorpayKeyId ?? ''); setEnabled(c.enabled); setMode(c.checkoutMode ?? (c.enabled ? 'ONLINE' : null));
  }, [cfgLoad.data]);
  useEffect(() => { if (setLoad.data) { setUpi(setLoad.data.upiId ?? ''); setBank(setLoad.data.bankDetails ?? ''); } }, [setLoad.data]);

  const cfg = cfgLoad.data;
  const keyProblem = keyId.trim() && !RAZORPAY_KEY_PATTERN.test(keyId.trim())
    ? (keyId.includes('@') ? 'That looks like an e-mail address. The Razorpay Key ID starts with rzp_test_ or rzp_live_.' : 'The Key ID starts with rzp_test_ or rzp_live_, for example rzp_live_AbC123xyz789.') : '';

  async function saveKeys() {
    setErr(''); setSaved(''); setTest(null);
    if (keyProblem) { setErr(keyProblem); return; }
    setBusy(true);
    try {
      await bos('/vendor-payments', { method: 'PUT', body: { razorpayKeyId: keyId.trim(), enabled, ...(mode ? { checkoutMode: mode } : {}), ...(secret.trim() ? { razorpayKeySecret: secret.trim() } : {}) } });
      setSecret(''); setSaved('Saved.'); cfgLoad.reload();
    } catch (e) { setErr(plain(e)); } finally { setBusy(false); }
  }
  async function runTest() {
    setErr(''); setTest(null); setTesting(true);
    try { setTest(await bos<{ ok: boolean; message: string }>('/vendor-payments/test', { method: 'POST', body: { ...(keyId.trim() ? { razorpayKeyId: keyId.trim() } : {}), ...(secret.trim() ? { razorpayKeySecret: secret.trim() } : {}) } })); }
    catch (e) { setErr(plain(e)); } finally { setTesting(false); }
  }
  async function saveManual() {
    setErr(''); setSaved('');
    try { await bos('/bos/settings', { method: 'PUT', body: { upiId: upi.trim(), bankDetails: bank.trim() } }); setSaved('Saved. These appear on your invoices under "Pay to".'); } catch (e) { setErr(plain(e)); }
  }

  if (cfgLoad.loading && !cfg) return <div className="flex min-h-[40vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const ready = enabled && RAZORPAY_KEY_PATTERN.test(keyId.trim()) && (cfg?.hasSecret || secret.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-2">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><CreditCard className="h-6 w-6 text-primary-600" /> Collect payments</h1>
        <p className="mt-1 text-sm text-slate-500">How your customers pay <strong>you</strong>. Money goes straight into your own account; Get4Domain never holds it. What you pay Get4Domain is separate and lives under Plan and billing.</p>
      </div>
      {err && <Alert>{err}</Alert>}
      {saved && <Alert tone="ok">{saved}</Alert>}

      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">How should customers order on your website?</h2>
        <div role="radiogroup" aria-label="Checkout mode" className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            ['ORDER_REQUEST', 'Order request (no online payment)', 'The customer sends their name, phone and delivery address. You get the order in Orders, call them and collect payment yourself. Stock is held for them meanwhile.'],
            ['ONLINE', 'Online payment (Razorpay)', 'The customer pays on the website straight into your own Razorpay account. Needs your Razorpay keys below.'],
          ] as [Mode, string, string][]).map(([m, title, text]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-xl border p-3.5 text-left transition-colors ${mode === m ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${mode === m ? 'border-primary-600 bg-primary-600' : 'border-slate-300'}`}>{mode === m && <Check className="h-3 w-3 text-white" />}</span>{title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{text}</p>
            </button>
          ))}
        </div>
        {!mode && <p className="mt-3 text-xs text-amber-700">Not chosen yet. Until you pick one, customers see &ldquo;order by phone&rdquo;.</p>}
        <div className="mt-4"><Button onClick={saveKeys} loading={busy} leftIcon={<Check className="h-4 w-4" />}>Save</Button></div>
      </Card>

      <Card padded>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck className="h-4 w-4 text-success-600" /> My own Razorpay account {cfg?.mode && <span className={`rounded-full px-2 py-0.5 text-xs ${cfg.mode === 'live' ? 'bg-success-50 text-success-700' : 'bg-amber-50 text-amber-700'}`}>{cfg.mode === 'live' ? 'live keys' : 'test keys'}</span>}</div>
          <button type="button" role="switch" aria-checked={enabled} aria-label="Accept online payments on my website" onClick={() => setEnabled((v) => !v)} className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-success-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'left-0.5 translate-x-5' : 'left-0.5'}`} /></button>
        </div>
        {cfg?.keyIdInvalid && <div className="mt-3"><Alert>The Key ID saved earlier is not a Razorpay key, so online payment is off. Enter your Key ID below (it starts with rzp_).</Alert></div>}
        {/* autocomplete is off and the names are not login-like, so a browser cannot drop a saved e-mail or password into these boxes */}
        <form className="mt-4 space-y-4" autoComplete="off" onSubmit={(e) => { e.preventDefault(); void saveKeys(); }}>
          <Field label="Razorpay Key ID" hint={keyProblem || 'Starts with rzp_test_ or rzp_live_. Find it in Razorpay: Account and settings, API keys.'}>
            <input name="razorpay-key-id" id="razorpay-key-id" type="text" inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" data-form-type="other"
              className={`${inputCls} ${keyProblem ? '!border-error-300' : ''}`} value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx" />
          </Field>
          <Field label="Razorpay Key Secret" hint={cfg?.hasSecret ? 'A secret is saved and is never shown again. Leave this empty to keep it.' : 'Stored encrypted. Never shown again.'}>
            <input name="razorpay-key-secret" id="razorpay-key-secret" type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" className={inputCls} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={cfg?.hasSecret ? '•••••••• (saved)' : 'Paste your key secret'} />
          </Field>
          {test && <Alert tone={test.ok ? 'ok' : 'error'}>{test.message}</Alert>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={busy} leftIcon={<Check className="h-4 w-4" />}>Save keys</Button>
            <Button type="button" variant="outline" loading={testing} onClick={runTest} disabled={!(keyId.trim() && (secret.trim() || cfg?.hasSecret))}>Test connection</Button>
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">Get my keys <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </form>
      </Card>

      <div className={`rounded-xl border px-4 py-3 text-sm ${ready ? 'border-success-200 bg-success-50 text-success-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {ready ? <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Online payment is on. Customers can pay on your website, and the &ldquo;Pay now&rdquo; button also appears on the invoices you share.</span>
          : <span className="inline-flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Add your Razorpay Key ID and secret and turn it on to accept online payment. Without it, invoices show your UPI and bank details instead of a Pay now button.</span>}
      </div>

      <Card padded>
        <h2 className="text-sm font-bold text-slate-900">Collecting by UPI or bank transfer</h2>
        <p className="mt-1 text-xs text-slate-500">These are printed on every invoice under &ldquo;Pay to&rdquo;. No account is needed; customers simply pay you and you record the receipt.</p>
        <div className="mt-3 space-y-3">
          <Field label="UPI ID"><input name="shop-upi" className={inputCls} value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourshop@okbank" autoComplete="off" /></Field>
          <Field label="Bank details"><textarea name="shop-bank" className={inputCls} rows={3} value={bank} onChange={(e) => setBank(e.target.value)} placeholder={'Account name, number, IFSC, bank and branch'} autoComplete="off" /></Field>
          {upi.trim() && <p className="text-xs text-slate-500">Phones can open this to pay: <a className="font-semibold text-primary-600" href={`upi://pay?pa=${encodeURIComponent(upi.trim())}`}>upi://pay?pa={upi.trim()}</a></p>}
          <Button variant="outline" onClick={saveManual}>Save</Button>
        </div>
      </Card>
    </div>
  );
}
