'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

interface Vendor { id: string; name: string; businessName: string; email: string; industry?: string }
interface Toggle { key: string; label: string; enabled: boolean; walletGated?: boolean }
interface IndustrySummary { key: string; label: string }
interface IndustryConfig { key: string; label: string; availableAddons: string[]; defaultAddons: string[] }

export default function VendorAccessPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [industries, setIndustries] = useState<IndustrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Vendor | null>(null);
  const [modules, setModules] = useState<Toggle[]>([]);
  const [addons, setAddons] = useState<Toggle[]>([]);
  const [industryCfg, setIndustryCfg] = useState<IndustryConfig | null>(null);
  const [override, setOverride] = useState({ accentColor: '', accentColorDark: '', welcomeText: '', websiteTemplate: '' });
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);
  const [busyKey, setBusyKey] = useState('');

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '', phone: '', industry: 'general' });

  const loadVendors = useCallback(() => {
    setLoading(true);
    Promise.all([api.getVendors(), api.getIndustries(true)])
      .then(([v, ind]) => { setVendors(v.data ?? []); setIndustries(ind.data ?? []); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const selectVendor = async (v: Vendor) => {
    setSelected(v);
    setModules([]); setAddons([]); setIndustryCfg(null);
    setOverride({ accentColor: '', accentColorDark: '', welcomeText: '', websiteTemplate: '' });
    try {
      const [m, a, cfg, ov] = await Promise.all([
        api.adminGetVendorModules(v.id),
        api.adminGetVendorAddons(v.id),
        api.getIndustryConfig(v.industry ?? 'general'),
        api.getVendorOverride(v.id).catch(() => ({ data: {} })),
      ]);
      setModules(m.data ?? []);
      setAddons(a.data ?? []);
      setIndustryCfg(cfg.data ?? null);
      const o = ov.data ?? {};
      setOverride({ accentColor: o.accentColor ?? '', accentColorDark: o.accentColorDark ?? '', welcomeText: o.welcomeText ?? '', websiteTemplate: o.websiteTemplate ?? '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor access');
    }
  };

  const toggleModule = async (key: string, enabled: boolean) => {
    if (!selected) return;
    setBusyKey(`m:${key}`);
    try {
      const res = await api.setVendorModule(key, selected.id, enabled);
      setModules(res.data ?? []);
    } finally { setBusyKey(''); }
  };

  const toggleAddon = async (key: string, enabled: boolean) => {
    if (!selected) return;
    setBusyKey(`a:${key}`);
    try {
      const res = await api.setVendorAddon(key, selected.id, enabled);
      setAddons(res.data ?? []);
    } finally { setBusyKey(''); }
  };

  const applyIndustryDefaults = async () => {
    if (!selected || !industryCfg) return;
    for (const addonKey of industryCfg.defaultAddons) {
      await api.setVendorAddon(addonKey, selected.id, true);
    }
    await api.setVendorModule('domainapp', selected.id, true);
    selectVendor(selected);
  };

  const createVendor = async () => {
    if (!form.name || !form.email || form.password.length < 8 || !form.businessName) {
      setError('Fill name, email, business name and an 8+ char password.');
      return;
    }
    setCreating(true); setError('');
    try {
      const res = await api.createVendor(form);
      const newVendor = res.data as Vendor;
      // Seed industry default addons + DomainApp core.
      try {
        const cfg = await api.getIndustryConfig(form.industry);
        for (const addonKey of cfg.data.defaultAddons ?? []) {
          await api.setVendorAddon(addonKey, newVendor.id, true);
        }
        await api.setVendorModule('domainapp', newVendor.id, true);
      } catch { /* seeding best-effort */ }
      setForm({ name: '', email: '', password: '', businessName: '', phone: '', industry: 'general' });
      loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor');
    } finally {
      setCreating(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-primary-500 focus:outline-none';

  const ToggleRow = ({ t, onToggle, busy }: { t: Toggle; onToggle: (k: string, e: boolean) => void; busy: boolean }) => (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <div className="text-sm font-medium text-white">{t.label}</div>
        {t.walletGated && <div className="text-[11px] text-warning-400">Wallet-gated (always available)</div>}
      </div>
      <button disabled={busy || t.walletGated} onClick={() => onToggle(t.key, !t.enabled)} className="disabled:opacity-40">
        {t.enabled ? <ToggleRight className="h-6 w-6 text-primary-500" /> : <ToggleLeft className="h-6 w-6 text-slate-600" />}
      </button>
    </div>
  );

  async function saveOverride() {
    if (!selected) return;
    setSavingOverride(true); setOverrideSaved(false);
    try {
      // Send only filled fields (empty = clear/no override for that key).
      const payload: Record<string, string> = {};
      if (override.accentColor) payload.accentColor = override.accentColor;
      if (override.accentColorDark) payload.accentColorDark = override.accentColorDark;
      if (override.welcomeText) payload.welcomeText = override.welcomeText;
      if (override.websiteTemplate) payload.websiteTemplate = override.websiteTemplate;
      await api.setVendorOverride(selected.id, payload);
      setOverrideSaved(true); setTimeout(() => setOverrideSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save override');
    } finally { setSavingOverride(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

  const availableAddonSet = new Set(industryCfg?.availableAddons ?? []);
  const filteredAddons = addons.filter((a) => availableAddonSet.size === 0 || availableAddonSet.has(a.key));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Vendor Access &amp; Onboarding</h2>
        <p className="mt-1 text-sm text-slate-400">Create vendors and control their modules &amp; addons.</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/40 px-4 py-3 text-sm text-error-300">{error}</div>}

      {/* Onboarding */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><UserPlus className="h-4 w-4 text-primary-400" />New Vendor</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className={inputCls} placeholder="Owner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <input className={inputCls} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputCls} placeholder="Password (8+ chars)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
            {industries.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
          </select>
        </div>
        <button onClick={createVendor} disabled={creating} className="mt-4 flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          <UserPlus className="h-4 w-4" />{creating ? 'Creating…' : 'Create Vendor + seed defaults'}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Vendor list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="max-h-[60vh] divide-y divide-slate-800 overflow-y-auto">
            {vendors.map((v) => (
              <button key={v.id} onClick={() => selectVendor(v)} className={`w-full px-4 py-3 text-left hover:bg-slate-800 ${selected?.id === v.id ? 'bg-slate-800' : ''}`}>
                <div className="text-sm font-semibold text-white">{v.businessName}</div>
                <div className="text-xs text-slate-500">{v.industry ?? 'general'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Access controls */}
        <div>
          {!selected ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
              Select a vendor to manage access
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-white">{selected.businessName}</div>
                  <div className="text-xs text-slate-500">{selected.email} · {selected.industry ?? 'general'}</div>
                </div>
                <button onClick={applyIndustryDefaults} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800">
                  <Sparkles className="h-3.5 w-3.5" />Apply industry defaults
                </button>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">Modules</div>
                <div className="divide-y divide-slate-800">
                  {modules.map((m) => <ToggleRow key={m.key} t={m} onToggle={toggleModule} busy={busyKey === `m:${m.key}`} />)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">Addons ({industryCfg?.label ?? '—'})</div>
                <div className="divide-y divide-slate-800">
                  {filteredAddons.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">No addons available for this industry.</div>
                  ) : filteredAddons.map((a) => <ToggleRow key={a.key} t={a} onToggle={toggleAddon} busy={busyKey === `a:${a.key}`} />)}
                </div>
              </div>

              {/* 3C — per-vendor website & dashboard override (layers on the industry skin) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Per-vendor override (applied live)</div>
                <p className="mb-3 text-xs text-slate-500">Hand-tune this vendor on top of the {industryCfg?.label ?? 'industry'} skin. Leave blank to use the default.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300">Accent <input type="color" value={override.accentColor || '#2563eb'} onChange={(e) => setOverride({ ...override, accentColor: e.target.value })} className="h-8 w-12 rounded border border-slate-700 bg-slate-900" /><button onClick={() => setOverride({ ...override, accentColor: '' })} className="text-xs text-slate-500 hover:underline">clear</button></label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">Accent dark <input type="color" value={override.accentColorDark || '#1d4ed8'} onChange={(e) => setOverride({ ...override, accentColorDark: e.target.value })} className="h-8 w-12 rounded border border-slate-700 bg-slate-900" /><button onClick={() => setOverride({ ...override, accentColorDark: '' })} className="text-xs text-slate-500 hover:underline">clear</button></label>
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Welcome text override" value={override.welcomeText} onChange={(e) => setOverride({ ...override, welcomeText: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Website template key override (optional)" value={override.websiteTemplate} onChange={(e) => setOverride({ ...override, websiteTemplate: e.target.value })} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={saveOverride} disabled={savingOverride} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{savingOverride ? 'Saving…' : 'Save override'}</button>
                  {overrideSaved && <span className="text-xs font-medium text-success-400">Saved — live</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
