'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Globe, ExternalLink, CheckCircle2, Circle, Loader2, ShieldCheck, Rocket,
  Zap, ArrowRight, AlertTriangle, Sparkles,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { canonicalIndustryId } from '@/data/demo-site';
import { realEstateWebsite } from '@/engine/industries/real-estate/config';
import type { EngineSiteData, ReadinessCheck } from '@/engine/types';

interface CmsShape {
  businessName: string | null; tagline: string | null; about: string | null;
  logo: string | null; banner: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; address: string | null; seoTitle: string | null; seoDesc: string | null; seoKeywords: string | null;
}
interface ProductShape { id: string; name: string; description: string | null; price: string | null; image: string | null; category: string | null; customFields: Record<string, string> | null }
interface EngineAction { intent: string; industry: string; delegatesTo: string; description: string; public: boolean }

/**
 * Vendor-facing engine console for the reference industry: live preview, the
 * revenue-readiness checklist (computed from the SAME config the public site uses),
 * publish confirmation, custom-domain hand-off (reuses existing ResellerClub flow),
 * and the real transactional actions wired for this site.
 */
export default function WebsiteEnginePage() {
  const { user } = useAuth();
  const industry = canonicalIndustryId(user?.industry ?? '');
  const onEngine = industry === 'realestate';

  const [cms, setCms] = useState<CmsShape | null>(null);
  const [products, setProducts] = useState<ProductShape[]>([]);
  const [actions, setActions] = useState<EngineAction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.getVendorCMS(user.id).then((r) => r.data ?? null).catch(() => null),
      api.getVendorProducts(user.id).then((r) => r.data ?? []).catch(() => []),
      api.engineListActions().then((r) => r.data ?? r ?? []).catch(() => []),
    ]).then(([c, p, a]) => {
      setCms(c);
      setProducts(p);
      setActions((a as EngineAction[]).filter((x) => x.industry === 'realestate'));
    }).finally(() => setLoading(false));
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const siteData: EngineSiteData | null = useMemo(() => {
    if (!user) return null;
    return {
      vendor: { id: user.id, businessName: user.businessName ?? '', industry, subdomain: user.subdomain ?? null },
      cms: cms ? { ...cms, businessHours: null } : null,
      products,
    };
  }, [user, cms, products, industry]);

  const checks: ReadinessCheck[] = useMemo(
    () => (siteData && onEngine ? realEstateWebsite.readiness(siteData) : []),
    [siteData, onEngine],
  );
  const required = checks.filter((c) => c.weight === 'required');
  const requiredPassed = required.filter((c) => c.passed).length;
  const allPassed = checks.filter((c) => c.passed).length;
  const revenueReady = required.every((c) => c.passed);

  const liveUrl = user?.subdomain ? `/site/${user.subdomain}` : '';
  const previewUrl = onEngine ? `/engine/preview/realestate` : '';

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!onEngine) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-10">
        <h1 className="text-xl font-bold text-slate-900">Website Engine</h1>
        <Card padded className="text-sm text-slate-600">
          <Sparkles className="mb-2 h-5 w-5 text-brand-500" />
          The premium industry website engine is live for <b>Real Estate</b> today and rolling out to every industry.
          Your industry ({user?.industry || 'general'}) still uses the current website — manage it from{' '}
          <Link href="/dashboard/my-website" className="font-semibold text-brand-500">Website Manager</Link>.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Website Engine — Real Estate</h1>
          <p className="mt-0.5 text-sm text-slate-500">A bespoke property website with real enquiry, site-visit and booking-token payment flows.</p>
        </div>
        <div className="flex gap-2">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" leftIcon={<Sparkles className="h-4 w-4" />}>Preview design</Button>
            </a>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <Button leftIcon={<ExternalLink className="h-4 w-4" />}>View my live site</Button>
            </a>
          )}
        </div>
      </div>

      {/* Revenue readiness */}
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${revenueReady ? 'bg-success-100 text-success-600' : 'bg-amber-100 text-amber-600'}`}>
              {revenueReady ? <Rocket className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </span>
            <div>
              <div className="font-bold text-slate-900">{revenueReady ? 'Revenue-ready' : 'Almost there'}</div>
              <div className="text-sm text-slate-500">{requiredPassed}/{required.length} required · {allPassed}/{checks.length} total checks passed</div>
            </div>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.round((allPassed / Math.max(1, checks.length)) * 100)}%` }} />
          </div>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
              {c.passed
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                : <Circle className={`mt-0.5 h-4 w-4 shrink-0 ${c.weight === 'required' ? 'text-amber-500' : 'text-slate-300'}`} />}
              <div>
                <div className="text-sm font-medium text-slate-800">{c.label}
                  {c.weight === 'required' && !c.passed && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Required</span>}
                </div>
                {c.hint && !c.passed && <div className="mt-0.5 text-xs text-slate-500">{c.hint}</div>}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          <Link href="/dashboard/my-website"><Button variant="outline" leftIcon={<Globe className="h-4 w-4" />}>Edit content</Button></Link>
          <Link href="/dashboard/domain-management"><Button variant="outline" leftIcon={<Globe className="h-4 w-4" />}>Connect a domain</Button></Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {revenueReady
              ? <span className="inline-flex items-center gap-1.5 font-semibold text-success-600"><CheckCircle2 className="h-4 w-4" /> Your site can take leads &amp; payments now</span>
              : <span className="inline-flex items-center gap-1.5 text-amber-600"><AlertTriangle className="h-4 w-4" /> Complete the required items to go fully live</span>}
          </div>
        </div>
      </Card>

      {/* Wired transactional actions — provenance into the real backend */}
      <Card padded>
        <div className="mb-1 flex items-center gap-2"><Zap className="h-4 w-4 text-brand-500" /><h2 className="font-bold text-slate-900">Live business actions</h2></div>
        <p className="mb-4 text-sm text-slate-500">These run on your public website and write straight into your real dashboard — no parallel system.</p>
        <div className="space-y-2">
          {actions.length === 0 && <p className="text-sm text-slate-400">No engine actions found.</p>}
          {actions.map((a) => (
            <div key={a.intent} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <span className="rounded-lg bg-brand-50 px-2 py-1 font-mono text-xs text-brand-600">{a.intent.replace('realestate.', '')}</span>
              {a.public && <span className="inline-flex items-center gap-1 rounded bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-700"><ShieldCheck className="h-3 w-3" /> Public</span>}
              <span className="text-sm text-slate-600">{a.description}</span>
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                <ArrowRight className="h-3 w-3" /> {a.delegatesTo}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
