'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, Loader2, LifeBuoy, Package } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Profile { businessName: string; tagline: string; phone: string; whatsapp: string; email: string; address: string; googleMaps: string }
const EMPTY: Profile = { businessName: '', tagline: '', phone: '', whatsapp: '', email: '', address: '', googleMaps: '' };
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200';

/**
 * Business profile: the details customers see on your website and in messages. Saves for real (VendorCMS, the same record the website reads).
 * Name, e-mail and password of the login itself are changed through Support so we can confirm them with you.
 */
export default function BusinessProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getVendorCMS(user.id)
      .then((r) => {
        const c = (r?.data ?? {}) as Partial<Profile>;
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(c).filter(([k, v]) => k in EMPTY && typeof v === 'string')) as Partial<Profile>, businessName: c.businessName || user.businessName || '' });
      })
      .catch(() => setForm({ ...EMPTY, businessName: user.businessName ?? '' }))
      .finally(() => setLoading(false));
  }, [user]);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.businessName.trim()) { setError('Enter your business name.'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) { setError('That e-mail address does not look right.'); return; }
    setSaving(true); setError('');
    try {
      await api.updateVendorCMS(user.id, Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Building2 className="h-5 w-5 text-primary-600" /> Business profile</h2>
        <p className="mt-1 text-sm text-slate-500">What customers see on your website. Changes show on the site within a minute.</p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="bp-name" className="mb-1.5 block text-xs font-medium text-slate-600">Business name</label>
          <input id="bp-name" value={form.businessName} onChange={set('businessName')} className={inputCls} maxLength={120} />
        </div>
        <div>
          <label htmlFor="bp-tag" className="mb-1.5 block text-xs font-medium text-slate-600">One-line description</label>
          <input id="bp-tag" value={form.tagline} onChange={set('tagline')} className={inputCls} maxLength={200} placeholder="e.g. Footwear and apparel in Vadapalani, Chennai" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="bp-phone" className="mb-1.5 block text-xs font-medium text-slate-600">Phone</label><input id="bp-phone" value={form.phone} onChange={set('phone')} className={inputCls} inputMode="tel" /></div>
          <div><label htmlFor="bp-wa" className="mb-1.5 block text-xs font-medium text-slate-600">WhatsApp number</label><input id="bp-wa" value={form.whatsapp} onChange={set('whatsapp')} className={inputCls} inputMode="tel" /></div>
        </div>
        <div><label htmlFor="bp-email" className="mb-1.5 block text-xs font-medium text-slate-600">Business e-mail</label><input id="bp-email" type="email" value={form.email} onChange={set('email')} className={inputCls} /></div>
        <div><label htmlFor="bp-addr" className="mb-1.5 block text-xs font-medium text-slate-600">Address</label><textarea id="bp-addr" rows={3} value={form.address} onChange={set('address')} className={`${inputCls} resize-none`} /></div>
        <div><label htmlFor="bp-map" className="mb-1.5 block text-xs font-medium text-slate-600">Google Maps link <span className="text-slate-400">(optional)</span></label><input id="bp-map" value={form.googleMaps} onChange={set('googleMaps')} className={inputCls} /></div>

        {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{error}</div>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} leftIcon={<Check className="h-4 w-4" />}>Save</Button>
          {saved && <span role="status" className="text-sm font-medium text-success-600">Saved — your website will show this shortly.</span>}
        </div>
      </form>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your login</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Name</dt><dd className="font-medium text-slate-900">{user?.name || '—'}</dd></div>
          <div><dt className="text-xs text-slate-500">E-mail</dt><dd className="break-all font-medium text-slate-900">{user?.email || '—'}</dd></div>
        </dl>
        <p className="flex items-start gap-2 text-slate-600"><LifeBuoy className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />To change your login name, e-mail or password, raise a request in <Link href="/dashboard/account/help" className="font-semibold text-primary-700 underline">Help and support</Link>; we confirm it with you first.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Extras</h3>
        <Link href="/dashboard/account/stationery" className="inline-flex items-center gap-2 font-semibold text-primary-700 hover:underline"><Package className="h-4 w-4" /> Office and stationery tracker</Link>
      </div>
    </div>
  );
}
