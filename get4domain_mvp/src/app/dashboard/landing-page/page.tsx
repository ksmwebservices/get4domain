'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink, Copy, Share2, Loader2, Sparkles, Eye, Users, TrendingUp, ArrowRight, Check,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface CampaignPage {
  id: string;
  slug: string;
  title: string;
  headline: string;
  subheadline: string | null;
  phone: string;
  whatsapp: string;
  views: number;
}

interface Analytics {
  views: number;
  leads: number;
  conversion: number;
}

const SITE_URL = 'https://get4domain.com';

export default function LandingPagePage() {
  const { user } = useAuth();
  const [page, setPage] = useState<CampaignPage | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ title: '', phone: '', whatsapp: '', subheadline: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [createForm, setCreateForm] = useState({
    industry: user?.industry ?? '',
    businessName: user?.businessName ?? '',
    offerTitle: '',
    description: '',
    phone: '',
    whatsapp: '',
  });
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{ headline: string; subheadline: string; benefits: string[]; aboutText: string; ctaText: string } | null>(null);

  useEffect(() => {
    api.getCampaignPages()
      .then((res) => {
        const pages = (res.data ?? []) as CampaignPage[];
        const first = pages[0] ?? null;
        setPage(first);
        if (first) {
          setForm({ title: first.title, phone: first.phone, whatsapp: first.whatsapp, subheadline: first.subheadline ?? '' });
          return api.getCampaignPageAnalytics(first.id).then((a) => setAnalytics(a.data ?? null));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your page'))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    try {
      const res = await api.generateCampaignPage(createForm);
      setGenerated(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate() {
    if (!generated) return;
    setError('');
    setCreating(true);
    try {
      const res = await api.createCampaignPage({
        title: createForm.businessName,
        headline: generated.headline,
        subheadline: generated.subheadline,
        benefits: generated.benefits,
        aboutText: generated.aboutText,
        ctaText: generated.ctaText,
        phone: createForm.phone,
        whatsapp: createForm.whatsapp,
      });
      const newPage = res.data as CampaignPage;
      setPage(newPage);
      setForm({ title: newPage.title, phone: newPage.phone, whatsapp: newPage.whatsapp, subheadline: newPage.subheadline ?? '' });
      setAnalytics({ views: 0, leads: 0, conversion: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your page');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!page) return;
    setError('');
    setSaving(true);
    setSaved(false);
    try {
      await api.updateCampaignPage(page.id, form);
      setPage({ ...page, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShare(url: string) {
    if (navigator.share) {
      navigator.share({ title: page?.title, url }).catch(() => {});
    } else {
      handleCopy(url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Page</h2>
          <p className="mt-1 text-sm text-slate-500">Create your campaign landing page — this is where your ads and posts will send people.</p>
        </div>

        {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Business Name</label>
              <input value={createForm.businessName} onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Industry</label>
              <input value={createForm.industry} onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</label>
              <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">WhatsApp</label>
              <input value={createForm.whatsapp} onChange={(e) => setCreateForm({ ...createForm, whatsapp: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Offer / What to promote</label>
            <input value={createForm.offerTitle} onChange={(e) => setCreateForm({ ...createForm, offerTitle: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label>
            <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
          </div>

          {!generated ? (
            <Button loading={generating} onClick={handleGenerate} leftIcon={<Sparkles className="h-4 w-4" />}>
              Generate Page with AI
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 space-y-2">
                <div className="text-sm font-bold text-slate-900">{generated.headline}</div>
                <div className="text-xs text-slate-600">{generated.subheadline}</div>
                <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                  {generated.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setGenerated(null)}>Regenerate</Button>
                <Button loading={creating} onClick={handleCreate} rightIcon={<ArrowRight className="h-4 w-4" />}>Create My Page</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pageUrl = `${SITE_URL}/go/${page.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Page</h2>
        <p className="mt-1 text-sm text-slate-500">Your public campaign landing page — share this everywhere.</p>
      </div>

      {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src={qrUrl} alt="QR code" className="h-32 w-32 rounded-xl border border-slate-200 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Page URL</div>
            <div className="mt-1 truncate text-base font-bold text-primary-700">{pageUrl}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={pageUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Visit</Button>
              </a>
              <Button size="sm" variant="outline" onClick={() => handleCopy(pageUrl)} leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleShare(pageUrl)} leftIcon={<Share2 className="h-3.5 w-3.5" />}>Share</Button>
            </div>
          </div>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Eye, label: 'Views', value: analytics.views },
            { icon: Users, label: 'Leads', value: analytics.leads },
            { icon: TrendingUp, label: 'Conversion', value: `${analytics.conversion}%` },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <Icon className="h-4 w-4 text-primary-600 mx-auto mb-1.5" />
                <div className="text-lg font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Edit Page Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Business Name</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">WhatsApp</label>
            <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tagline</label>
            <input value={form.subheadline} onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button loading={saving} onClick={handleSave}>Save Changes</Button>
          {saved && <span className="text-sm font-medium text-success-600 flex items-center gap-1"><Check className="h-4 w-4" />Saved</span>}
        </div>
      </div>

      <Link href={`/dashboard/crm?source=campaign_page`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        View All Leads <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
