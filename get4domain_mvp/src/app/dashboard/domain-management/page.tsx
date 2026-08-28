'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Search, Link2, Copy, ExternalLink, CheckCircle2, Loader2, LifeBuoy, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

type Tab = 'my' | 'buy' | 'connect';

interface DomainConfig { searchEnabled: boolean; aRecordIp: string; cnameTarget: string }
interface SearchResult { domain: string; tld: string; available: boolean; status: string; pricePaise: number; priceLabel: string }
interface MyDomain { id: string; domainName: string; tld: string; source: string; status: string; pricePaise: number; expiresAt: string | null }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-success-50 text-success-700' },
  mapping_pending: { label: 'Point your DNS', cls: 'bg-amber-50 text-amber-700' },
  registered: { label: 'Registered', cls: 'bg-primary-50 text-primary-700' },
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  failed: { label: 'Failed', cls: 'bg-error-50 text-error-700' },
};

export default function DomainManagementPage() {
  const { user } = useAuth();
  const subdomain = user?.subdomain ? `${user.subdomain}.get4domain.com` : 'yourbusiness.get4domain.com';

  const [tab, setTab] = useState<Tab>('my');
  const [config, setConfig] = useState<DomainConfig | null>(null);
  const [myDomains, setMyDomains] = useState<MyDomain[]>([]);

  // Buy tab
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [buyError, setBuyError] = useState('');
  const [registering, setRegistering] = useState<string | null>(null);

  // Connect tab
  const [connectDomain, setConnectDomain] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'checking' | 'active' | 'notfound'>('idle');

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  const loadMine = useCallback(() => {
    api.getMyDomains().then((res) => setMyDomains(res.data ?? [])).catch(() => setMyDomains([]));
  }, []);

  useEffect(() => {
    api.domainConfig().then((res) => setConfig(res.data)).catch(() => setConfig({ searchEnabled: false, aRecordIp: '34.14.130.68', cnameTarget: subdomain }));
    loadMine();
  }, [loadMine, subdomain]);

  const aRecordIp = config?.aRecordIp ?? '34.14.130.68';
  const cnameTarget = config?.cnameTarget ?? subdomain;

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setBuyError('');
    setResults(null);
    try {
      const res = await api.domainSearch(query.trim());
      setResults(res.data ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setBuyError(/not.?configured|unavailable/i.test(msg) ? 'notconfigured' : msg);
    } finally {
      setSearching(false);
    }
  }

  async function buy(domain: string) {
    setRegistering(domain);
    setBuyError('');
    try {
      await api.domainRegister({ domain });
      alert(`${domain} registered! Next, point your DNS to activate it (see the Connect tab / My Domain).`);
      loadMine();
      setTab('my');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      if (/INSUFFICIENT_WALLET_BALANCE/.test(msg)) setBuyError('Not enough wallet balance. Please top up your wallet and try again.');
      else if (/NOT_CONFIGURED/.test(msg)) setBuyError('Domain registration is being enabled. Please contact support to register this domain now.');
      else setBuyError(msg);
    } finally {
      setRegistering(null);
    }
  }

  async function verify() {
    if (!connectDomain.trim()) return;
    setVerifying(true);
    setVerifyResult('checking');
    try {
      await api.domainConnect(connectDomain.trim());
      const res = await api.domainVerify(connectDomain.trim());
      setVerifyResult(res.data?.propagated ? 'active' : 'notfound');
      loadMine();
    } catch {
      setVerifyResult('notfound');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Globe className="h-5 w-5 text-primary-600" />Domain</h1>
        <p className="mt-1 text-sm text-slate-500">Your free subdomain, custom domain purchase, and connecting a domain you own.</p>
      </div>

      <div className="flex rounded-xl border border-slate-200 bg-white p-1">
        {([['my', 'My Domains'], ['buy', 'Buy Domain'], ['connect', 'Connect Domain']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === k ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'my' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your subdomain</div>
                <div className="mt-1 font-mono text-sm text-slate-900">{subdomain}</div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700"><span className="h-1.5 w-1.5 rounded-full bg-success-500" />Active</span>
            </div>
            <div className="mt-4 flex gap-2">
              <a href={`https://${subdomain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><ExternalLink className="h-4 w-4" />Visit Site</a>
              <button onClick={() => navigator.clipboard?.writeText(`https://${subdomain}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Copy className="h-4 w-4" />Copy URL</button>
            </div>
          </div>

          {myDomains.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custom domains</div>
              <p className="mt-1 text-sm text-slate-500">No custom domain yet. Buy one or connect a domain you already own.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myDomains.map((d) => {
                const s = STATUS_LABEL[d.status] ?? STATUS_LABEL.pending;
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <div className="font-mono text-sm text-slate-900">{d.domainName}</div>
                      <div className="text-xs text-slate-500">{d.source === 'connected' ? 'Connected (you own it)' : 'Registered via Get4Domain'}{d.expiresAt ? ` · renews ${new Date(d.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                      {d.status === 'mapping_pending' && (
                        <button onClick={() => { setConnectDomain(d.domainName); setTab('connect'); }} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Set up DNS</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'buy' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()} placeholder="Enter a domain name" className={inputClass} />
            <button onClick={runSearch} disabled={searching} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search
            </button>
          </div>

          {buyError && buyError !== 'notconfigured' && (
            <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{buyError}</div>
          )}

          {(buyError === 'notconfigured' || (config && !config.searchEnabled && !results)) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
              <p className="text-sm font-semibold text-amber-800">Domain registration is being enabled</p>
              <p className="mt-1 text-sm text-amber-700">Our registrar connection is being finalized. Contact support to register your domain now (from ₹599/year .in, ₹999/year .com).</p>
              <a href="/dashboard/support" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm"><LifeBuoy className="h-4 w-4" />Contact Support</a>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.domain} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <div className="font-mono text-sm text-slate-900">{r.domain}</div>
                    <div className="text-xs text-slate-500">{r.available ? `Available · ${r.priceLabel}` : 'Taken'}</div>
                  </div>
                  {r.available ? (
                    <button onClick={() => buy(r.domain)} disabled={registering === r.domain} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                      {registering === r.domain ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}Register · {r.priceLabel}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">Unavailable</span>
                  )}
                </div>
              ))}
              <p className="text-center text-xs text-slate-400">Registration is charged from your wallet. Prices include our margin; renew yearly.</p>
            </div>
          )}
          {results && results.length === 0 && (
            <p className="text-center text-sm text-slate-500">No results — try a different name.</p>
          )}
        </div>
      )}

      {tab === 'connect' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Point a domain at your site.</p>
            <p className="mt-1 text-xs text-slate-500">Works for a domain you bought here or one you already own elsewhere.</p>
            <input value={connectDomain} onChange={(e) => setConnectDomain(e.target.value)} placeholder="www.mybusiness.com" className={`${inputClass} mt-3`} />
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-600">Update these DNS records with your domain registrar:</p>
              <div className="mt-2 space-y-1 font-mono text-xs text-slate-600">
                <div>Type: A &nbsp;| Name: @ &nbsp;| Value: {aRecordIp}</div>
                <div>Type: CNAME | Name: www | Value: {cnameTarget}</div>
              </div>
              <p className="mt-2 text-xs text-slate-500">After updating, click Verify. Propagation can take up to 24 hours.</p>
            </div>
            <button onClick={verify} disabled={verifying || !connectDomain} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Verify Domain
            </button>
            {verifyResult === 'active' && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-success-700"><CheckCircle2 className="h-4 w-4" />Verified! Your domain is now active with automatic SSL.</p>
            )}
            {verifyResult === 'notfound' && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500" />DNS records not found yet. Propagation can take up to 24 hours — try again later or contact support.</p>
            )}
            {verifyResult === 'checking' && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking DNS…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
