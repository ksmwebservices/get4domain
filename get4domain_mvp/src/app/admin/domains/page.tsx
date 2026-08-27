'use client';

import { useState } from 'react';
import { Globe, Search, Loader2, Link2, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';

interface MyDomain { id: string; domainName: string; tld: string; source: string; status: string; pricePaise: number; expiresAt: string | null }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-success-50 text-success-700' },
  mapping_pending: { label: 'Point DNS', cls: 'bg-amber-50 text-amber-700' },
  registered: { label: 'Registered', cls: 'bg-primary-50 text-primary-700' },
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  failed: { label: 'Failed', cls: 'bg-error-50 text-error-700' },
};

// Admin-assist: complete domain steps on a vendor's behalf (dispatch 26-Aug-2026,
// Phase 2 item 4). Same wallet-safe service as vendor self-service, admin-guarded.
export default function AdminDomainsPage() {
  const [vendorId, setVendorId] = useState('');
  const [domains, setDomains] = useState<MyDomain[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  async function load() {
    if (!vendorId.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await api.adminGetDomains(vendorId.trim());
      setDomains(res.data ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to load');
      setDomains(null);
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    if (!vendorId.trim() || !domain.trim()) return;
    setBusy('register');
    setMsg('');
    try {
      await api.adminDomainRegister({ vendorId: vendorId.trim(), domain: domain.trim() });
      setMsg(`Registered ${domain} for vendor (charged to their wallet).`);
      setDomain('');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setBusy('');
    }
  }

  async function verify(d: string) {
    setBusy(`verify:${d}`);
    setMsg('');
    try {
      const res = await api.adminDomainVerify({ vendorId: vendorId.trim(), domain: d });
      setMsg(res.data?.propagated ? `${d} verified and activated.` : `${d}: DNS not propagated yet.`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="max-w-3xl space-y-6 p-1">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Globe className="h-5 w-5 text-primary-600" />Domains — Admin Assist</h1>
        <p className="mt-1 text-sm text-slate-500">Register or verify a domain on a vendor&apos;s behalf. Registration is charged to the vendor&apos;s wallet.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor ID</label>
        <div className="mt-2 flex gap-2">
          <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Paste the vendor's ID (from Vendors)" className={inputClass} />
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Load
          </button>
        </div>
      </div>

      {msg && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>}

      {domains !== null && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Register on behalf</div>
            <div className="mt-2 flex gap-2">
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="myshop.in" className={inputClass} />
              <button onClick={register} disabled={busy === 'register'} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                {busy === 'register' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Register
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {domains.length === 0 ? (
              <p className="text-sm text-slate-500">No domains for this vendor yet.</p>
            ) : domains.map((d) => {
              const s = STATUS_LABEL[d.status] ?? STATUS_LABEL.pending;
              return (
                <div key={d.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="font-mono text-sm text-slate-900">{d.domainName}</div>
                    <div className="text-xs text-slate-500">{d.source === 'connected' ? 'Connected' : 'Registered'}{d.expiresAt ? ` · renews ${new Date(d.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    {d.status === 'mapping_pending' && (
                      <button onClick={() => verify(d.domainName)} disabled={busy === `verify:${d.domainName}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        {busy === `verify:${d.domainName}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}Verify DNS
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
