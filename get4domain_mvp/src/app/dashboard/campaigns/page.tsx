'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Loader2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, X, Wallet,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  status: string;
  channels: string[];
  walletCost: number;
  createdAt: string;
}

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp Broadcast', cost: 100 },
  { id: 'sms', label: 'SMS Blast', cost: 50 },
  { id: 'email', label: 'Email Campaign', cost: 10 },
  { id: 'facebook', label: 'Facebook Post', cost: 1000 },
  { id: 'instagram', label: 'Instagram Post', cost: 500 },
  { id: 'paid_ads', label: 'Paid Ads', cost: 20000 },
];

const AI_CHANNELS = new Set(['facebook', 'instagram']);

const formatCurrency = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

type GeneratedContent = { caption: string; hashtags?: string[]; imagePrompt?: string; imageUrl?: string | null };

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [brief, setBrief] = useState({ whatToPromote: '', targetAudience: '', startDate: '', endDate: '' });
  const [channels, setChannels] = useState<string[]>([]);
  const [content, setContent] = useState<Record<string, GeneratedContent>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api.getCampaigns()
      .then((res) => setCampaigns(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const pendingCount = campaigns.filter((c) => c.status === 'pending_approval' || c.status === 'approved').length;
  const totalCost = channels.reduce((sum, c) => sum + (CHANNELS.find((ch) => ch.id === c)?.cost ?? 0), 0);

  function resetWizard() {
    setStep(1);
    setBrief({ whatToPromote: '', targetAudience: '', startDate: '', endDate: '' });
    setChannels([]);
    setContent({});
    setError('');
  }

  function toggleChannel(id: string) {
    setChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function generateContent() {
    setGenerating(true);
    setError('');
    const result: Record<string, GeneratedContent> = {};
    try {
      for (const channel of channels) {
        if (AI_CHANNELS.has(channel)) {
          const res = await api.generateAiContent({
            channel,
            vendorIndustry: user?.industry ?? 'general',
            offerDetails: `${brief.whatToPromote}${brief.targetAudience ? ` — targeting ${brief.targetAudience}` : ''}`,
            tone: 'friendly',
          });
          result[channel] = res.data;
        } else {
          result[channel] = {
            caption: `${brief.whatToPromote}${brief.targetAudience ? ` — perfect for ${brief.targetAudience}` : ''}. Contact us to know more!`,
          };
        }
      }
      setContent(result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI content generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function submitCampaign() {
    setSubmitting(true);
    setError('');
    try {
      const created = await api.createCampaign({
        name: brief.whatToPromote.slice(0, 60) || 'New Campaign',
        description: brief.targetAudience,
        channels,
        content,
        startDate: brief.startDate || undefined,
        endDate: brief.endDate || undefined,
      });
      const campaignId = created.data.id as string;
      await api.approveCampaign(campaignId);
      setWizardOpen(false);
      resetWizard();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit campaign');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campaigns</h2>
          <p className="mt-1 text-sm text-slate-500">Create and track your marketing campaigns.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { resetWizard(); setWizardOpen(true); }}>Create Campaign</Button>
      </div>

      {error && !wizardOpen && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      {pendingCount > 0 && (
        <div className="rounded-2xl border border-warning-200 bg-warning-50 px-5 py-3.5 text-sm font-medium text-warning-800">
          {pendingCount} campaign{pendingCount > 1 ? 's' : ''} pending our team&apos;s action
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">No campaigns yet — create your first one.</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{c.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.channels.join(', ')} · {formatCurrency(c.walletCost)}</div>
              </div>
              <span className="flex-shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 capitalize">{c.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-primary-600' : 'bg-slate-200'}`} />
                ))}
              </div>
              <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {error && <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Step 1 — Campaign Brief</h3>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">What to promote?</label>
                  <textarea rows={2} value={brief.whatToPromote} onChange={(e) => setBrief({ ...brief, whatToPromote: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Target audience</label>
                  <input value={brief.targetAudience} onChange={(e) => setBrief({ ...brief, targetAudience: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">Start date</label>
                    <input type="date" value={brief.startDate} onChange={(e) => setBrief({ ...brief, startDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">End date</label>
                    <input type="date" value={brief.endDate} onChange={(e) => setBrief({ ...brief, endDate: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                </div>
                <Button fullWidth disabled={!brief.whatToPromote.trim()} rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => setStep(2)}>Next</Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Step 2 — Select Channels</h3>
                <div className="space-y-2">
                  {CHANNELS.map((ch) => (
                    <label key={ch.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition-colors ${channels.includes(ch.id) ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} className="h-4 w-4 rounded text-primary-600 focus:ring-primary-400" />
                        <span className="text-sm font-medium text-slate-800">{ch.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{formatCurrency(ch.cost)}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">Estimated cost</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalCost)}</span>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(1)}>Back</Button>
                  <Button fullWidth loading={generating} disabled={channels.length === 0} leftIcon={!generating && <Sparkles className="h-4 w-4" />} onClick={generateContent}>
                    {generating ? 'AI is creating your campaign content…' : 'Generate Content with AI'}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Step 3 — Review Content</h3>
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <div key={ch} className="rounded-xl border border-slate-200 p-3.5">
                      <div className="text-xs font-semibold text-primary-600 capitalize mb-1.5">{CHANNELS.find((c) => c.id === ch)?.label}</div>
                      <textarea
                        rows={2}
                        value={content[ch]?.caption ?? ''}
                        onChange={(e) => setContent({ ...content, [ch]: { ...content[ch], caption: e.target.value } })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
                      />
                      {content[ch]?.hashtags && content[ch].hashtags!.length > 0 && (
                        <div className="mt-1.5 text-xs text-slate-400">{content[ch].hashtags!.map((h) => `#${h}`).join(' ')}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(2)}>Back</Button>
                  <Button fullWidth rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => setStep(4)}>Next</Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900">Step 4 — Review & Submit</h3>
                <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Promoting</span><span className="font-medium text-slate-900 text-right">{brief.whatToPromote}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Channels</span><span className="font-medium text-slate-900">{channels.length}</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Total Wallet Cost</span><span className="text-primary-700">{formatCurrency(totalCost)}</span></div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-xs text-primary-700">
                  <Wallet className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  Submitting will deduct {formatCurrency(totalCost)} from your wallet and send this campaign to our team for execution.
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(3)}>Back</Button>
                  <Button fullWidth loading={submitting} leftIcon={!submitting && <CheckCircle2 className="h-4 w-4" />} onClick={submitCampaign}>Submit for Approval</Button>
                </div>
                {error?.includes('INSUFFICIENT') && (
                  <Link href="/dashboard/wallet" className="block text-center text-xs font-semibold text-primary-600 hover:underline">Top up your wallet →</Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
