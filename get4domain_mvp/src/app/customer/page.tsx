'use client';

import { useCallback, useEffect, useState } from 'react';
import { Home, FileText, Receipt, LifeBuoy, LogOut, Phone, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';
const TOKEN_KEY = 'g4d_customer_token';

async function portalFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Error');
  return body.data ?? body;
}

interface Profile {
  contact: { id: string; name: string; phone: string; email?: string };
  vendor: { businessName?: string };
  industry: { key: string; label: string; record: { label: string; labelPlural: string }; contact: { label: string } };
}
interface RecordItem { id: string; status: string; date: string; amount: number; catalogItem?: { name: string } }
interface InvoiceItem { id: string; invoiceNumber: string; total: number; status: string; createdAt: string }

type Tab = 'home' | 'records' | 'invoices' | 'support';

export default function CustomerPortal() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // login state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // data
  const [tab, setTab] = useState<Tab>('home');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [supportMsg, setSupportMsg] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const me = await portalFetch('/customer/me');
      setProfile(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setProfile(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)) loadProfile();
    else setBooting(false);
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    portalFetch('/customer/records').then(setRecords).catch(() => setRecords([]));
    portalFetch('/customer/invoices').then(setInvoices).catch(() => setInvoices([]));
  }, [profile]);

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      const res = await portalFetch('/customer/request-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      setDevOtp(res.devOtp ?? '');
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const res = await portalFetch('/customer/verify', { method: 'POST', body: JSON.stringify({ phone, otp }) });
      localStorage.setItem(TOKEN_KEY, res.token);
      await loadProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
    } finally { setBusy(false); }
  };

  const logout = () => { localStorage.removeItem(TOKEN_KEY); setProfile(null); setStep('phone'); setPhone(''); setOtp(''); };

  if (booting) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  // ---- Login ----
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50"><Phone className="h-6 w-6 text-primary-600" /></div>
            <h1 className="text-lg font-bold text-slate-900">Customer Portal</h1>
            <p className="text-sm text-slate-500">Sign in with your phone number</p>
          </div>
          {error && <div className="mb-3 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">{error}</div>}
          {step === 'phone' ? (
            <div className="space-y-3">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <button onClick={requestOtp} disabled={busy || !phone} className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {busy ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg tracking-widest focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              {devOtp && <p className="text-center text-xs text-slate-400">Dev OTP: <span className="font-mono font-semibold">{devOtp}</span></p>}
              <button onClick={verify} disabled={busy || !otp} className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {busy ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button onClick={() => setStep('phone')} className="w-full text-center text-xs text-slate-500">Change number</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Authenticated ----
  const recordLabel = profile.industry.record;
  const navItems: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'records', label: recordLabel.labelPlural, icon: FileText },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
    { key: 'support', label: 'Support', icon: LifeBuoy },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <div className="text-sm font-bold text-slate-900">{profile.vendor.businessName ?? 'Your Provider'}</div>
          <div className="text-xs text-slate-500">Hi, {profile.contact.name}</div>
        </div>
        <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><LogOut className="h-5 w-5" /></button>
      </header>

      <main className="mx-auto max-w-2xl p-5">
        {tab === 'home' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-slate-900">Welcome back 👋</h1>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-2xl font-bold text-slate-900">{records.length}</div>
                <div className="text-xs text-slate-500">{recordLabel.labelPlural}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-2xl font-bold text-slate-900">{invoices.filter((i) => i.status !== 'PAID').length}</div>
                <div className="text-xs text-slate-500">Unpaid invoices</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'records' && (
          <div className="space-y-2">
            <h1 className="mb-2 text-lg font-bold text-slate-900">Your {recordLabel.labelPlural}</h1>
            {records.length === 0 ? <p className="text-sm text-slate-400">Nothing here yet.</p> : records.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{r.catalogItem?.name ?? recordLabel.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">{r.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{new Date(r.date).toLocaleDateString('en-IN')} · ₹{(r.amount ?? 0).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'invoices' && (
          <div className="space-y-2">
            <h1 className="mb-2 text-lg font-bold text-slate-900">Invoices</h1>
            {invoices.length === 0 ? <p className="text-sm text-slate-400">No invoices yet.</p> : invoices.map((inv) => (
              <div key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'PAID' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>{inv.status}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</span>
                  <span className="text-base font-bold text-slate-900">₹{(inv.total ?? 0).toLocaleString('en-IN')}</span>
                </div>
                {inv.status !== 'PAID' && (
                  <button onClick={() => alert('Payment link will be sent by your provider.')} className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Pay Now</button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'support' && (
          <div className="space-y-3">
            <h1 className="mb-2 text-lg font-bold text-slate-900">Support</h1>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm text-slate-600">Send a message to {profile.vendor.businessName ?? 'your provider'}.</p>
              <textarea rows={4} value={supportMsg} onChange={(e) => setSupportMsg(e.target.value)} placeholder="How can we help?"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              <button onClick={() => { setSupportMsg(''); alert('Message sent (mock).'); }} disabled={!supportMsg.trim()}
                className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Send Message</button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white">
        {navItems.map((item) => {
          const Ic = item.icon;
          return (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${tab === item.key ? 'text-primary-600' : 'text-slate-500'}`}>
              <Ic className="h-5 w-5" />{item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
