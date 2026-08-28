'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Megaphone, Eye, MessageSquare, Calendar, Check, ArrowRight, ArrowLeft,
  Target, Sparkles, Link2, Copy, TrendingUp, Clock, ExternalLink, Loader2,
} from 'lucide-react';
import { Icon, Badge, Modal } from '@/components/vendor';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// The self-service campaign screen (Bolt reference): a vendor builds their OWN
// campaign page, gets a shareable /go/[slug] link, and tracks views/enquiries.
// Wired to the real campaign-pages endpoints — no approval, no wallet request.

const SITE_URL = 'https://get4domain.com';

type Status = 'Live' | 'Draft';

interface CampaignRow {
  id: string;
  slug: string;
  title: string;
  headline: string;
  views: number;
  leadCount: number;
  active: boolean;
  createdAt: string;
  phone: string;
  whatsapp: string;
}

const THUMBS = [
  'from-brand-600 to-brand-900',
  'from-gold-500 to-ruby-600',
  'from-ruby-600 to-brand-800',
  'from-brand-500 to-success',
  'from-gold-400 to-brand-700',
  'from-success to-brand-700',
];
const thumbFor = (id: string) => THUMBS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % THUMBS.length];

const statusVariant: Record<Status, 'success' | 'warning'> = { Live: 'success', Draft: 'warning' };
const statusOf = (c: CampaignRow): Status => (c.active ? 'Live' : 'Draft');

const goalOptions = [
  'Book more appointments',
  'Increase brand awareness',
  'Generate new leads',
  'Boost product sales',
  'Launch a new service',
];

const audienceChips = ['Existing customers', 'New leads', 'Local area', 'Festival shoppers', 'Premium segment'];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

interface GenContent { headline: string; subheadline: string; benefits: string[]; aboutText?: string; ctaText?: string }

export default function CampaignsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [selected, setSelected] = useState<CampaignRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getCampaignPages()
      .then((res) => setRows((res.data ?? []) as CampaignRow[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(
    (c) => (filter === 'all' || statusOf(c) === filter) && c.title.toLowerCase().includes(search.toLowerCase()),
  );
  const totalViews = rows.reduce((s, c) => s + (c.views ?? 0), 0);
  const totalEnquiries = rows.reduce((s, c) => s + (c.leadCount ?? 0), 0);
  const liveCount = rows.filter((c) => c.active).length;

  return (
    <div className="vendor-ui -m-5 min-h-[calc(100vh-4rem)] space-y-5 bg-ink-950 bg-radial-glow p-5 text-ink-100 lg:-m-8 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-50">Campaigns</h1>
          <p className="mt-0.5 text-sm text-ink-500">Build a campaign page, share the link, and track results.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-4 w-4" />New Campaign</button>
      </div>

      {error && <div className="rounded-xl border border-ruby-800/50 bg-ruby-950/40 px-4 py-3 text-sm text-ruby-300">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-500"><Eye className="h-3.5 w-3.5" />Total Views</div>
          <div className="text-xl font-extrabold text-ink-50">{totalViews.toLocaleString('en-IN')}</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-500"><MessageSquare className="h-3.5 w-3.5" />Enquiries</div>
          <div className="text-xl font-extrabold text-ink-50">{totalEnquiries}</div>
        </div>
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-500"><span className="h-2 w-2 rounded-full bg-success animate-pulse" />Live Now</div>
          <div className="text-xl font-extrabold text-success">{liveCount}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns…" className="input !pl-9" />
        </div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border border-ink-700/40 bg-ink-850/60 p-1">
          {(['all', 'Live', 'Draft'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === f ? 'bg-brand-600/20 text-brand-300' : 'text-ink-400 hover:text-ink-200'}`}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1fr_110px_130px_120px_40px] gap-4 border-b border-ink-700/40 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-600 lg:grid">
          <span>Campaign</span><span>Status</span><span>Created</span><span>Results</span><span></span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-ink-500">
            {rows.length === 0 ? 'No campaigns yet — create your first one.' : 'No campaigns match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-ink-700/30">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelected(c)}
                className="grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition hover:bg-ink-800/40 lg:grid-cols-[1fr_110px_130px_120px_40px] lg:gap-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${thumbFor(c.id)} shadow-v-card`}>
                    <Megaphone className="h-5 w-5 text-white/90" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink-100">{c.title}</div>
                    <div className="truncate text-xs text-ink-500">get4domain.com/go/{c.slug}</div>
                  </div>
                </div>
                <div><Badge variant={statusVariant[statusOf(c)]} size="xs" dot={c.active}>{statusOf(c)}</Badge></div>
                <div className="hidden items-center gap-1.5 text-xs text-ink-400 lg:flex"><Calendar className="h-3.5 w-3.5 text-ink-600" />{fmtDate(c.createdAt)}</div>
                <div className="hidden items-center gap-3 text-xs lg:flex">
                  {c.views > 0 || c.leadCount > 0 ? (
                    <>
                      <span className="flex items-center gap-1 text-ink-300"><Eye className="h-3.5 w-3.5 text-ink-600" />{c.views.toLocaleString('en-IN')}</span>
                      <span className="flex items-center gap-1 text-ink-300"><MessageSquare className="h-3.5 w-3.5 text-ink-600" />{c.leadCount}</span>
                    </>
                  ) : <span className="text-ink-600">—</span>}
                </div>
                <ArrowRight className="hidden h-4 w-4 text-ink-600 lg:block" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title} subtitle={selected ? `get4domain.com/go/${selected.slug}` : undefined} size="lg">
        {selected && <CampaignDetail campaign={selected} />}
      </Modal>

      <CreateWizard open={creating} onClose={() => setCreating(false)} onCreated={load} industry={user?.industry ?? 'general'} businessName={user?.businessName ?? user?.name ?? ''} existing={rows[0] ?? null} />
    </div>
  );
}

function CampaignDetail({ campaign }: { campaign: CampaignRow }) {
  const url = `${SITE_URL}/go/${campaign.slug}`;
  const [copied, setCopied] = useState(false);
  const [analytics, setAnalytics] = useState<{ views: number; leads: number; conversion: number } | null>(null);

  useEffect(() => {
    api.getCampaignPageAnalytics(campaign.id).then((r) => setAnalytics(r.data ?? null)).catch(() => setAnalytics(null));
  }, [campaign.id]);

  const views = analytics?.views ?? campaign.views;
  const leads = analytics?.leads ?? campaign.leadCount;
  const conv = analytics?.conversion ?? (views > 0 ? Number(((leads / views) * 100).toFixed(1)) : 0);

  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="space-y-5">
      <div className={`relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br ${thumbFor(campaign.id)}`}>
        <div className="absolute inset-0 bg-grid-faint bg-[size:20px_20px] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <Badge variant={statusVariant[statusOf(campaign)]} size="sm" dot={campaign.active}>{statusOf(campaign)}</Badge>
          <span className="flex items-center gap-1.5 text-xs text-white/80"><Calendar className="h-3.5 w-3.5" />{fmtDate(campaign.createdAt)}</span>
        </div>
      </div>

      {views > 0 || leads > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center"><Eye className="mx-auto mb-2 h-5 w-5 text-brand-400" /><div className="text-xl font-extrabold text-ink-50">{views.toLocaleString('en-IN')}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">Page Views</div></div>
          <div className="card p-4 text-center"><MessageSquare className="mx-auto mb-2 h-5 w-5 text-gold-400" /><div className="text-xl font-extrabold text-ink-50">{leads}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">Enquiries</div></div>
          <div className="card p-4 text-center"><TrendingUp className="mx-auto mb-2 h-5 w-5 text-success" /><div className="text-xl font-extrabold text-ink-50">{conv}%</div><div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">Conv. Rate</div></div>
        </div>
      ) : (
        <div className="card p-6 text-center"><Clock className="mx-auto mb-2 h-8 w-8 text-ink-600" /><p className="text-sm text-ink-400">No results yet — share your campaign page to start tracking views and enquiries.</p></div>
      )}

      <div className="card p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-400"><Link2 className="h-3.5 w-3.5" />Shareable Campaign Page</div>
        <div className="flex items-center gap-2 rounded-xl border border-ink-700/50 bg-ink-900/60 p-3">
          <span className="flex-1 truncate text-xs text-ink-400">{url}</span>
          <button onClick={copy} className="btn-ghost-soft !px-2 !py-1 text-xs">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>

      <div className="flex gap-2">
        <Link href="/dashboard/landing-page" className="btn-ghost flex-1"><Sparkles className="h-4 w-4" />Edit content</Link>
        <a href={url} target="_blank" rel="noreferrer" className="btn-primary flex-1"><ExternalLink className="h-4 w-4" />Open page</a>
      </div>
    </div>
  );
}

function CreateWizard({ open, onClose, onCreated, industry, businessName, existing }: {
  open: boolean; onClose: () => void; onCreated: () => void; industry: string; businessName: string; existing: CampaignRow | null;
}) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [gen, setGen] = useState<GenContent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  // Prefill contact from an existing page when available.
  useEffect(() => {
    if (open) {
      setPhone(existing?.phone ?? '');
      setWhatsapp(existing?.whatsapp ?? '');
    }
  }, [open, existing]);

  const reset = () => {
    setStep(0); setGoal(''); setAudience(''); setOffer(''); setGen(null);
    setReminderDate(''); setReminderNote(''); setErr('');
  };
  const close = () => { reset(); onClose(); };

  async function generate() {
    if (!offer.trim() || !phone.trim() || !whatsapp.trim()) { setErr('Add what you’re promoting plus a phone and WhatsApp number.'); return; }
    setGenerating(true); setErr('');
    try {
      const res = await api.generateCampaignPage({
        industry, businessName,
        offerTitle: offer,
        description: `Goal: ${goal || 'grow the business'}. Audience: ${audience || 'local customers'}.`,
        phone, whatsapp,
      });
      setGen(res.data as GenContent);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function create() {
    setCreating(true); setErr('');
    try {
      const headline = gen?.headline || offer;
      const benefits = gen?.benefits?.length ? gen.benefits : [goal || 'Great value', 'Trusted local business'];
      const res = await api.createCampaignPage({
        title: offer.slice(0, 80) || 'New Campaign',
        headline,
        subheadline: gen?.subheadline || audience || undefined,
        benefits,
        aboutText: gen?.aboutText,
        ctaText: gen?.ctaText || 'Enquire Now',
        phone, whatsapp,
        style: 'DARK',
      });
      const slug = res.data?.slug as string | undefined;
      // Personal share reminder (Bolt: a reminder, not an auto-post) — kept locally.
      if (slug && reminderDate) {
        try { localStorage.setItem(`g4d_campaign_reminder_${slug}`, JSON.stringify({ date: reminderDate, note: reminderNote })); } catch { /* ignore */ }
      }
      close();
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create campaign');
    } finally {
      setCreating(false);
    }
  }

  const steps = [
    { icon: 'Target', title: 'Campaign Goal', desc: 'What do you want to achieve?' },
    { icon: 'Users', title: 'Audience', desc: 'Who is this campaign for?' },
    { icon: 'Sparkles', title: 'Content', desc: 'Generate your campaign page' },
    { icon: 'Calendar', title: 'Schedule Reminder', desc: 'When do you plan to share it?' },
  ];
  const canNext = step === 0 ? !!goal : step === 2 ? !!gen || (!!offer && !!phone && !!whatsapp) : true;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create Campaign"
      subtitle={`Step ${step + 1} of 4`}
      size="lg"
      footer={
        <>
          {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-ghost"><ArrowLeft className="h-4 w-4" />Back</button>}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext} className="btn-primary">Continue<ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={create} disabled={creating || !gen && !offer} className="btn-gold">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Create Campaign</button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${i <= step ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-600'}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${i < step ? 'bg-brand-600' : 'bg-ink-800'}`} />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Icon name={steps[step].icon} className="h-5 w-5 text-brand-400" />
          <div><h3 className="text-base font-bold text-ink-100">{steps[step].title}</h3><p className="text-xs text-ink-500">{steps[step].desc}</p></div>
        </div>

        {err && <div className="rounded-xl border border-ruby-800/50 bg-ruby-950/40 px-3 py-2 text-xs text-ruby-300">{err}</div>}

        {step === 0 && (
          <div className="space-y-2">
            {goalOptions.map((g) => (
              <button key={g} onClick={() => setGoal(g)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${goal === g ? 'border-brand-500 bg-brand-500/20 ring-1 ring-brand-500/40' : 'border-ink-700/40 bg-ink-900/40 hover:border-brand-500/40 hover:bg-brand-500/5'}`}>
                <Target className="h-4 w-4 text-brand-400" /><span className="flex-1 text-sm text-ink-200">{g}</span>
                {goal === g && <Check className="h-4 w-4 text-brand-400" />}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={4} className="input resize-none" placeholder="e.g. Existing customers in Bangalore who haven't visited in 3+ months…" />
            <div className="flex flex-wrap gap-2">
              {audienceChips.map((t) => (
                <button key={t} onClick={() => setAudience((a) => (a ? `${a}, ${t}` : t))} className="chip border border-ink-700/40 bg-ink-800/60 text-ink-300 transition hover:border-brand-500/40 hover:text-brand-300">{t}</button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-400">What are you promoting?</label>
              <input value={offer} onChange={(e) => setOffer(e.target.value)} className="input" placeholder="e.g. Diwali Smile Offer — 20% off cleaning" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-400">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="Contact number" /></div>
              <div><label className="mb-1.5 block text-xs font-semibold text-ink-400">WhatsApp</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="input" placeholder="WhatsApp number" /></div>
            </div>
            <button onClick={generate} disabled={generating} className="btn-primary w-full">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{generating ? 'Generating your page…' : gen ? 'Regenerate content' : 'Generate with AI'}</button>
            {gen && (
              <div className="card space-y-2 p-4">
                <div className="text-sm font-bold text-ink-100">{gen.headline}</div>
                {gen.subheadline && <div className="text-xs text-ink-400">{gen.subheadline}</div>}
                <ul className="space-y-1">
                  {gen.benefits?.slice(0, 5).map((b, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-ink-300"><Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />{b}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
              <Clock className="h-4 w-4 shrink-0 text-gold-400" />
              <p className="text-xs text-ink-400">A personal reminder for when you plan to share your campaign — not an auto-post. You’ll share the link yourself wherever you like.</p>
            </div>
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-400">Plan to share on</label><input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="input" /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-ink-400">Note to self</label><input value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} className="input" placeholder="e.g. Share on WhatsApp groups and Instagram story" /></div>
            {!gen && <p className="text-xs text-ink-500">Tip: go back to Content and generate your page before creating.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
