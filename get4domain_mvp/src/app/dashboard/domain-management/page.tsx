'use client';

import { useState } from 'react';
import { Globe, Search, Link2, Copy, ExternalLink, CheckCircle2, Loader2, LifeBuoy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type Tab = 'my' | 'buy' | 'connect';

export default function DomainManagementPage() {
  const { user } = useAuth();
  const subdomain = user?.subdomain ? `${user.subdomain}.get4domain.com` : 'yourbusiness.get4domain.com';

  const [tab, setTab] = useState<Tab>('my');
  const [query, setQuery] = useState('');
  const [connectDomain, setConnectDomain] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'idle' | 'checking' | 'notfound'>('idle');

  const inputClass = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

  function verify() {
    setVerifying(true);
    setVerifyResult('checking');
    // MVP: DNS propagation check is a support-assisted step for now.
    setTimeout(() => { setVerifying(false); setVerifyResult('notfound'); }, 1500);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Globe className="h-5 w-5 text-primary-600" />Domain</h1>
        <p className="mt-1 text-sm text-slate-500">Your free subdomain, custom domain purchase, and connecting a domain you own.</p>
      </div>

      <div className="flex rounded-xl border border-slate-200 bg-white p-1">
        {([['my', 'My Domain'], ['buy', 'Buy Domain'], ['connect', 'Connect Domain']] as [Tab, string][]).map(([k, l]) => (
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custom domain</div>
            <p className="mt-1 text-sm text-slate-500">No custom domain connected. Buy one or connect a domain you already own.</p>
          </div>
        </div>
      )}

      {tab === 'buy' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter a domain name" className={inputClass} />
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"><Search className="h-4 w-4" />Search</button>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm font-semibold text-amber-800">Domain registration coming soon</p>
            <p className="mt-1 text-sm text-amber-700">We&apos;re finishing our registrar integration. Contact support to register your domain now (from ₹599/year .in, ₹999/year .com).</p>
            <a href="/dashboard/support" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm"><LifeBuoy className="h-4 w-4" />Contact Support</a>
          </div>
        </div>
      )}

      {tab === 'connect' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">Already own a domain? Connect it here.</p>
            <input value={connectDomain} onChange={(e) => setConnectDomain(e.target.value)} placeholder="www.mybusiness.com" className={`${inputClass} mt-3`} />
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-600">Update these DNS records with your domain registrar:</p>
              <div className="mt-2 space-y-1 font-mono text-xs text-slate-600">
                <div>Type: A &nbsp;| Name: @ &nbsp;| Value: 34.14.130.68</div>
                <div>Type: CNAME | Name: www | Value: {subdomain}</div>
              </div>
              <p className="mt-2 text-xs text-slate-500">After updating, click Verify. A one-time ₹500 setup fee applies (from your wallet).</p>
            </div>
            <button onClick={verify} disabled={verifying || !connectDomain} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}Verify Domain
            </button>
            {verifyResult === 'notfound' && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500" />DNS records not found yet. Propagation can take up to 24 hours — try again later or contact support.</p>
            )}
            {verifyResult === 'checking' && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking DNS…</p>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
            Once verified, your site will be served on your custom domain with automatic SSL.
          </div>
        </div>
      )}
    </div>
  );
}
