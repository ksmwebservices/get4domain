'use client';

import { useEffect, useState } from 'react';
import { IndianRupee, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';

interface SettingView { key: string; label: string; maskedValue?: string; value?: string }
interface CategoryGroup { category: string; label: string; settings: SettingView[] }

const DEFAULTS: Record<string, string> = {
  social_post: '5', festival_poster: '8', blog_article: '15', reel_script: '10',
  video_generation: '50', document: '15', whatsapp_message: '1', sms_message: '0.50',
  email_message: '0.10', social_post_publish: '10', extra_campaign_page: '20',
  domainapp_monthly: '999', topup_999_credits: '1100', topup_2499_credits: '3000', topup_4999_credits: '6500',
  trial_free_credit: '100', pro_free_credit: '999',
};

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Content Creation', keys: ['social_post', 'festival_poster', 'blog_article', 'reel_script', 'video_generation', 'document'] },
  { title: 'Messaging', keys: ['whatsapp_message', 'sms_message', 'email_message'] },
  { title: 'Campaign', keys: ['social_post_publish', 'extra_campaign_page'] },
  { title: 'Subscription (₹/month)', keys: ['domainapp_monthly'] },
  { title: 'Wallet Top-up Bonuses (credits given)', keys: ['topup_999_credits', 'topup_2499_credits', 'topup_4999_credits'] },
  { title: 'Plan Free Credit (per tier)', keys: ['trial_free_credit', 'pro_free_credit'] },
];

export default function AdminPricingPage() {
  const [defs, setDefs] = useState<SettingView[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPlatformSettings()
      .then((res) => {
        const groups = (res.data ?? []) as CategoryGroup[];
        const pricing = groups.find((g) => g.category === 'pricing');
        const settings = pricing?.settings ?? [];
        setDefs(settings);
        const v: Record<string, string> = {};
        settings.forEach((s) => { v[s.key] = s.maskedValue || s.value || DEFAULTS[s.key] || ''; });
        setValues(v);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load pricing'))
      .finally(() => setLoading(false));
  }, []);

  async function save(key: string) {
    setSavingKey(key);
    setError('');
    try {
      await api.setPlatformSetting('pricing', key, values[key] ?? '');
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingKey(null);
    }
  }

  const labelFor = (key: string) => defs.find((d) => d.key === key)?.label ?? key;

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white"><IndianRupee className="h-5 w-5 text-primary-400" />Pricing Manager</h1>
        <p className="mt-1 text-sm text-slate-400">Set wallet rates and subscription pricing. Stored in platform settings (category: pricing).</p>
      </div>

      {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}

      {GROUPS.map((group) => (
        <div key={group.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{group.title}</h2>
          <div className="space-y-3">
            {group.keys.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="flex-1 text-sm text-slate-300">{labelFor(key)}</label>
                <input
                  value={values[key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                  className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
                />
                <button onClick={() => save(key)} disabled={savingKey === key}
                  className="inline-flex w-20 items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
                  {savingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedKey === key ? <Check className="h-3.5 w-3.5" /> : 'Save'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-600">Note: rates persist in g4d_platform_settings. Wiring wallet deduction to read these live (vs. hardcoded defaults) is a backend follow-up.</p>
    </div>
  );
}
