'use client';

import { useWebsiteSection, WEBSITE_SECTION_TABS } from '@/dashboard-v2/section-context';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, ExternalLink, Copy, CheckCircle2, Loader2, Save, LayoutTemplate, Upload, Image as ImageIcon, GripVertical, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { editable, CMS_EDITABLE } from '@/lib/editable';
import { openMyWebsite } from '@/lib/view-website';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { api } from '@/lib/api';

type Tab = 'basic' | 'branding' | 'about' | 'seo' | 'template' | 'portfolio';

interface VendorCms {
  businessName: string | null; tagline: string | null; about: string | null;
  logo: string | null; banner: string | null; themeId: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; address: string | null;
  facebook: string | null; instagram: string | null; linkedin: string | null; youtube: string | null; googleMaps: string | null;
  seoTitle: string | null; seoDesc: string | null; seoKeywords: string | null; googleAnalyticsId: string | null;
}
interface PortfolioImage { id: string; src: string; alt?: string; title?: string; category?: string }
interface WebsiteTheme { id: string; name: string; description?: string | null; industry: string | null; cssVars: Record<string, string>; preview?: string | null; isDefault: boolean; price?: number | null; unlocked?: boolean }

const EMPTY: VendorCms = {
  businessName: '', tagline: '', about: '', logo: '', banner: '', themeId: '', phone: '', whatsapp: '', email: '', address: '',
  facebook: '', instagram: '', linkedin: '', youtube: '', googleMaps: '',
  seoTitle: '', seoDesc: '', seoKeywords: '', googleAnalyticsId: '',
};

const field = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

export default function WebsiteManagerPage() {
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  // Dashboard v2 offers this screen as three menu items; `section` limits the tabs (null = every tab, the old behaviour).
  const section = useWebsiteSection();
  const [tab, setTab] = useState<Tab>(section ? (WEBSITE_SECTION_TABS[section][0] as Tab) : 'basic');
  const [cms, setCms] = useState<VendorCms>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [themes, setThemes] = useState<WebsiteTheme[]>([]);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioImage[]>([]);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);

  const loadThemes = useCallback(() => {
    const q = user?.industry ? `?industry=${encodeURIComponent(user.industry)}` : '';
    api.myWebsiteThemes(q).then((res) => setThemes(res.data ?? [])).catch(() => setThemes([]));
  }, [user?.industry]);
  useEffect(() => { loadThemes(); }, [loadThemes]);

  // Premium template one-time unlock — charged to Get4Domain's platform Razorpay (+GST).
  const unlockTheme = async (t: WebsiteTheme) => {
    setError(''); setUnlocking(t.id);
    try {
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Payments are not configured.');
      const orderRes = await api.unlockThemeOrder(t.id);
      const order = (orderRes.data ?? orderRes) as { orderId: string; amount: number; currency: string };
      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load Razorpay'));
        document.body.appendChild(s);
      });
      const Rzp = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
      const rzp = new Rzp({
        key, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'Get4Domain', description: `Premium template — ${t.name}`,
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await api.unlockThemeConfirm(t.id, { razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
            loadThemes(); set('themeId', t.id);
          } catch (e) { setError(e instanceof Error ? e.message : 'Unlock failed after payment — contact support.'); }
          finally { setUnlocking(null); }
        },
        modal: { ondismiss: () => setUnlocking(null) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the unlock payment.');
      setUnlocking(null);
    }
  };

  const subdomainUrl = user?.subdomain ? `https://${user.subdomain}.get4domain.com` : '';
  const previewUrl = user?.subdomain ? `/site/${user.subdomain}` : '';

  const uploadFor = async (kind: 'logo' | 'banner', file: File) => {
    setUploading(kind);
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) set(kind, r.data.url);
    } catch {
      /* optional */
    } finally {
      setUploading(null);
    }
  };

  const load = useCallback(() => {
    if (!user) return;
    api.getVendorCMS(user.id).then((res) => {
      if (res.data) {
        setCms({ ...EMPTY, ...res.data, businessName: res.data.businessName ?? user.businessName ?? '' });
        setPortfolio(Array.isArray(res.data.portfolio) ? res.data.portfolio : []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof VendorCms, v: string) => setCms((p) => ({ ...p, [k]: v }));

  // Portfolio: each mutation saves immediately (same pattern as My Products'
  // gallery) rather than waiting on the shared "Save Changes" button below —
  // losing an upload because you forgot to click Save is worse than an extra
  // network call per action.
  const savePortfolio = async (next: PortfolioImage[]) => {
    if (!user) return;
    setPortfolio(next);
    setPortfolioSaving(true);
    try {
      await api.updateVendorCMS(user.id, { portfolio: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portfolio');
    } finally {
      setPortfolioSaving(false);
    }
  };

  const uploadPortfolioImage = async (file: File) => {
    setUploadingPortfolio(true);
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) {
        await savePortfolio([...portfolio, { id: `${Date.now()}`, src: r.data.url, title: '', category: '' }]);
      }
    } catch {
      /* optional */
    } finally {
      setUploadingPortfolio(false);
    }
  };

  // Title/category typing updates local state immediately (so the input feels
  // responsive) but only persists on blur - saving on every keystroke would fire
  // an API call per character.
  const updatePortfolioItemLocal = (id: string, patch: Partial<PortfolioImage>) => {
    setPortfolio((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const flushPortfolio = () => savePortfolio(portfolio);

  const removePortfolioItem = (id: string) => {
    savePortfolio(portfolio.filter((p) => p.id !== id));
  };

  const movePortfolioItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= portfolio.length) return;
    const next = [...portfolio];
    [next[index], next[target]] = [next[target], next[index]];
    savePortfolio(next);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.updateVendorCMS(user.id, editable(cms, CMS_EDITABLE));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const copyUrl = () => { navigator.clipboard.writeText(subdomainUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const tabs: { key: Tab; label: string }[] = ([
    { key: 'basic', label: 'Basic Info' },
    { key: 'branding', label: 'Logo & Banner' },
    { key: 'about', label: 'About & Social' },
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'seo', label: 'SEO' },
    { key: 'template', label: 'Template' },
  ] as { key: Tab; label: string }[]).filter((t) => !section || WEBSITE_SECTION_TABS[section].includes(t.key));

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Website Manager</h1>
          <p className="text-sm text-slate-500">Edit your site content — templates are handled for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openMyWebsite(user)}>Preview my site</Button>
          {previewUrl && (
            <Button size="sm" variant="ghost" leftIcon={copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />} onClick={copyUrl}>{copied ? 'Copied' : 'Copy URL'}</Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

      <Link href="/dashboard/my-products" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-sm hover:border-primary-200">
        <span className="text-slate-600">
          Manage your <span className="font-semibold text-slate-900">{cfg.industry?.entities.catalogItem.labelPlural ?? 'Products'}</span> — name, price, photos, gallery and variants — from <span className="font-semibold text-primary-700">My Products</span>.
        </span>
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-primary-500" />
      </Link>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>{t.label}</button>
        ))}
      </div>

      <Card>
        {tab === 'basic' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Business Name</label><input className={field} value={cms.businessName ?? ''} onChange={(e) => set('businessName', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Tagline</label><input className={field} value={cms.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Phone</label><input className={field} value={cms.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">WhatsApp</label><input className={field} value={cms.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Email</label><input className={field} value={cms.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Address</label><input className={field} value={cms.address ?? ''} onChange={(e) => set('address', e.target.value)} /></div>
          </div>
        )}

        {tab === 'branding' && (
          <div className="space-y-6">
            {/* Banner */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Banner image <span className="text-slate-400">— the hero photo at the top of your site</span></label>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {cms.banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cms.banner} alt="Banner" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-slate-100 text-slate-400"><ImageIcon className="h-8 w-8" /></div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {cms.banner ? 'Change banner' : 'Upload banner'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFor('banner', f); }} />
                </label>
                {cms.banner && <button type="button" onClick={() => set('banner', '')} className="text-xs text-error-600 hover:underline">Remove</button>}
              </div>
            </div>
            {/* Logo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Logo</label>
              <div className="flex items-center gap-3">
                {cms.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cms.logo} alt="Logo" className="h-16 w-16 rounded-xl border border-slate-200 object-contain p-1" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImageIcon className="h-6 w-6" /></div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {uploading === 'logo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {cms.logo ? 'Change logo' : 'Upload logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFor('logo', f); }} />
                </label>
                {cms.logo && <button type="button" onClick={() => set('logo', '')} className="text-xs text-error-600 hover:underline">Remove</button>}
              </div>
            </div>
          </div>
        )}

        {tab === 'about' && (
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">About your business</label><textarea rows={4} className={field} value={cms.about ?? ''} onChange={(e) => set('about', e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Facebook</label><input className={field} value={cms.facebook ?? ''} onChange={(e) => set('facebook', e.target.value)} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Instagram</label><input className={field} value={cms.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">LinkedIn</label><input className={field} value={cms.linkedin ?? ''} onChange={(e) => set('linkedin', e.target.value)} /></div>
              <div><label className="mb-1.5 block text-xs font-medium text-slate-600">YouTube</label><input className={field} value={cms.youtube ?? ''} onChange={(e) => set('youtube', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="mb-1.5 block text-xs font-medium text-slate-600">Google Maps link</label><input className={field} value={cms.googleMaps ?? ''} onChange={(e) => set('googleMaps', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 'portfolio' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                A categorized photo gallery for your site (e.g. Ceremony, Portraits, Details, Celebration for a
                photography site — type whatever categories fit your business; they show as filter chips on your
                live site). Each change saves instantly. {portfolioSaving && <span className="text-primary-600">Saving…</span>}
              </p>
            </div>
            {portfolio.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No portfolio photos yet — your site shows its original sample gallery until you add some.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((p, i) => (
                <div key={p.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt ?? ''} className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input value={p.title ?? ''} onChange={(e) => updatePortfolioItemLocal(p.id, { title: e.target.value })} onBlur={flushPortfolio} placeholder="Title"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-primary-400 focus:outline-none" />
                    <input value={p.category ?? ''} onChange={(e) => updatePortfolioItemLocal(p.id, { category: e.target.value })} onBlur={flushPortfolio} placeholder="Category (e.g. Ceremony)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-primary-400 focus:outline-none" />
                    <div className="flex items-center gap-1 pt-0.5">
                      <GripVertical className="h-3.5 w-3.5 text-slate-300" />
                      <button type="button" onClick={() => movePortfolioItem(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => movePortfolioItem(i, 1)} disabled={i === portfolio.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => removePortfolioItem(p.id)} className="ml-auto rounded p-1 text-slate-400 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
                {uploadingPortfolio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPortfolioImage(f); }} />
              </label>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('portfolioUrl') as HTMLInputElement;
                  const url = input.value.trim();
                  if (!url) return;
                  savePortfolio([...portfolio, { id: `${Date.now()}`, src: url, title: '', category: '' }]);
                  input.value = '';
                }}
              >
                <input name="portfolioUrl" placeholder="…or paste an image URL" className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-primary-400 focus:outline-none" />
                <Button type="submit" size="sm" variant="outline">Add</Button>
              </form>
            </div>
          </div>
        )}

        {tab === 'seo' && (
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">SEO Title</label><input className={field} value={cms.seoTitle ?? ''} onChange={(e) => set('seoTitle', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Meta Description</label><textarea rows={2} className={field} value={cms.seoDesc ?? ''} onChange={(e) => set('seoDesc', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Keywords (comma separated)</label><input className={field} value={cms.seoKeywords ?? ''} onChange={(e) => set('seoKeywords', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Google Analytics ID</label><input className={field} placeholder="G-XXXXXXX" value={cms.googleAnalyticsId ?? ''} onChange={(e) => set('googleAnalyticsId', e.target.value)} /></div>
          </div>
        )}

        {tab === 'template' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-primary-50 p-4">
              <LayoutTemplate className="h-6 w-6 text-primary-600" />
              <div>
                <div className="text-sm font-bold text-slate-900 capitalize">{cfg.industry?.websiteTemplate ?? 'default'} template</div>
                <div className="text-xs text-slate-500">Auto-selected for the {cfg.industry?.label ?? 'general'} industry.</div>
              </div>
            </div>
            {themes.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700">Choose a theme</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {themes.map((t) => {
                    const selected = cms.themeId === t.id || (!cms.themeId && t.isDefault);
                    const primary = t.cssVars?.['--primary'] ?? '#2563eb';
                    const accent = t.cssVars?.['--accent'] ?? primary;
                    const premium = (t.price ?? 0) > 0;
                    const locked = premium && !t.unlocked;
                    const inner = (
                      <>
                        {t.preview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.preview} alt={`${t.name} preview`} className="mb-2 h-24 w-full rounded-lg object-cover ring-1 ring-slate-200" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="h-6 w-6 rounded-md" style={{ background: primary }} />
                          <span className="h-6 w-6 rounded-md" style={{ background: accent }} />
                          <span className="ml-auto text-xs font-semibold text-slate-500">{selected ? 'Selected' : t.isDefault ? 'Default' : ''}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-sm font-bold text-slate-900">{t.name}</div>
                          {premium && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.unlocked ? 'bg-success-100 text-success-700' : 'bg-amber-100 text-amber-700'}`}>{t.unlocked ? 'Owned' : `₹${t.price}`}</span>}
                        </div>
                        {t.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p>}
                      </>
                    );
                    const previewLink = (
                      <a href={`/theme-preview/${t.id}`} target="_blank" rel="noopener noreferrer"
                        className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-semibold text-slate-600 hover:border-primary-300 hover:text-primary-700">
                        Preview
                      </a>
                    );
                    if (locked) {
                      return (
                        <div key={t.id} className="rounded-xl border-2 border-slate-200 p-3 text-left">
                          {inner}
                          {previewLink}
                          <button type="button" onClick={() => unlockTheme(t)} disabled={unlocking === t.id}
                            className="mt-2 w-full rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                            {unlocking === t.id ? 'Opening…' : `Unlock ₹${t.price} + GST`}
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={t.id} className={`rounded-xl border-2 p-3 text-left transition-colors ${selected ? 'border-primary-500 bg-primary-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                        <button type="button" onClick={() => set('themeId', t.id)} className="block w-full text-left">
                          {inner}
                        </button>
                        {previewLink}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-400">Themes are CSS-variable driven — switching one restyles your site without rebuilding it. Click Save Changes to apply.</p>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Globe className="h-4 w-4 text-primary-500" />Live preview</div>
              {subdomainUrl ? (
                <a href={subdomainUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">{subdomainUrl.replace('https://', '')}</a>
              ) : (
                <p className="text-sm text-slate-500">Your subdomain isn&apos;t set up yet — contact support to publish.</p>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Get4Domain-designed templates handle layout automatically. Industries without a
                dedicated template fall back to a clean default. (Hero images, gallery and
                testimonials editing arrive with the next template release.)
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
          <Button loading={saving} leftIcon={<Save className="h-4 w-4" />} onClick={save}>Save Changes</Button>
          {saved && <span className="flex items-center gap-1 text-xs font-medium text-success-600"><CheckCircle2 className="h-3.5 w-3.5" />Saved</span>}
        </div>
      </Card>
    </div>
  );
}
