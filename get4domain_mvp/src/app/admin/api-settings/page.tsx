'use client';

import { useEffect, useState } from 'react';
import { Info, Loader2, Save, Wifi, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface SettingView {
  category: string;
  key: string;
  label: string;
  secret: boolean;
  status: string;
  maskedValue: string;
  configured: boolean;
  source: 'db' | 'env' | 'none';
}
interface CategoryGroup {
  category: string;
  label: string;
  settings: SettingView[];
}

export default function IntegrationsPage() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState('');
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const load = () => {
    setLoading(true);
    api.getPlatformSettings()
      .then((res) => setGroups(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load (SUPER_ADMIN only)'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const id = (c: string, k: string) => `${c}:${k}`;

  const save = async (category: string, key: string) => {
    const value = drafts[id(category, key)];
    if (!value) return;
    setSavingKey(id(category, key));
    try {
      await api.setPlatformSetting(category, key, value);
      setDrafts((d) => ({ ...d, [id(category, key)]: '' }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKey('');
    }
  };

  const test = async (category: string, key: string) => {
    try {
      const res = await api.testPlatformSetting(category, key);
      setTestResult((t) => ({ ...t, [id(category, key)]: { ok: res.data?.status === 'ok', msg: res.data?.message ?? '' } }));
    } catch {
      setTestResult((t) => ({ ...t, [id(category, key)]: { ok: false, msg: 'Test failed' } }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Integrations</h2>
        <p className="mt-1 text-sm text-slate-400">API keys for all platform services — encrypted at rest (AES-256-GCM).</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/40 px-4 py-3 text-sm text-error-300">{error}</div>}

      <div className="flex items-start gap-3 rounded-xl border border-primary-800 bg-primary-950/40 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-400" />
        <p className="text-xs text-primary-300">
          Values are shown masked (last 4 chars). Saving encrypts the value into the database.
          Until a value is set here, the platform falls back to the server&apos;s <code className="rounded bg-slate-800 px-1 py-0.5">.env.local</code>.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.category} className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-3">
            <h3 className="text-sm font-bold text-white">{group.label}</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {group.settings.map((s) => {
              const tr = testResult[id(s.category, s.key)];
              return (
                <div key={s.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">{s.label}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-slate-500">{s.maskedValue || 'not set'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.source === 'db' ? 'bg-success-950 text-success-400' : s.source === 'env' ? 'bg-warning-950 text-warning-400' : 'bg-slate-800 text-slate-500'}`}>
                          {s.source === 'db' ? 'Configured' : s.source === 'env' ? 'Env fallback' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => test(s.category, s.key)} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
                      <Wifi className="h-3.5 w-3.5" />Test
                    </button>
                  </div>
                  {tr && (
                    <div className={`mt-2 flex items-center gap-1.5 text-xs ${tr.ok ? 'text-success-400' : 'text-error-400'}`}>
                      {tr.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{tr.msg}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      type={s.secret ? 'password' : 'text'}
                      placeholder={`New ${s.label}`}
                      value={drafts[id(s.category, s.key)] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [id(s.category, s.key)]: e.target.value }))}
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary-500 focus:outline-none"
                    />
                    <button
                      onClick={() => save(s.category, s.key)}
                      disabled={!drafts[id(s.category, s.key)] || savingKey === id(s.category, s.key)}
                      className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
                    >
                      <Save className="h-4 w-4" />Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
