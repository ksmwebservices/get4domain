'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

const FIELDS: Array<{ key: string; label: string; placeholder?: string }> = [
  { key: 'logo', label: 'Logo URL' },
  { key: 'favicon', label: 'Favicon URL' },
  { key: 'seoTitle', label: 'Site Title' },
  { key: 'seoDescription', label: 'Site Description' },
  { key: 'seoKeywords', label: 'Keywords (comma separated)' },
  { key: 'phone', label: 'Contact Phone' },
  { key: 'email', label: 'Contact Email' },
  { key: 'address', label: 'Address' },
];

export default function AdminCmsPage() {
  const [mounted, setMounted] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    api.getPlatformCMS()
      .then((res) => { setValues(res.data ?? {}); setError(''); })
      .catch(() => setError('Could not load live data — showing what we have.'))
      .finally(() => setLoading(false));
  }, [mounted]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await api.updatePlatformCMS(values);
      setValues(res.data ?? values);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Website CMS</h2>
        <p className="mt-1 text-sm text-slate-400">Controls get4domain.com's logo, SEO and contact details.</p>
      </div>

      {error && <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>}

      {values.logo && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex items-center gap-3">
          <img src={values.logo} alt="Logo preview" className="h-10 w-10 rounded-lg object-cover bg-slate-800" />
          <span className="text-xs text-slate-500">Current logo preview</span>
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">{f.label}</label>
            <input
              value={values[f.key] ?? ''}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-900"
            />
          </div>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="sm" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save All Settings</Button>
          {saved && <span className="text-xs font-medium text-success-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Saved</span>}
        </div>
      </form>
    </div>
  );
}
