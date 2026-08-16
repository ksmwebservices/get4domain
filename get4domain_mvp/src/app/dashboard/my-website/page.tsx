'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, ExternalLink, Copy, CheckCircle2, Loader2, Save, Plus, Trash2, LayoutTemplate, Upload, Image as ImageIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { useDashboardConfig } from '@/lib/dashboard-config';
import { api } from '@/lib/api';

type Tab = 'basic' | 'branding' | 'about' | 'seo' | 'services' | 'template';

interface VendorCms {
  businessName: string | null; tagline: string | null; about: string | null;
  logo: string | null; banner: string | null; themeId: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; address: string | null;
  facebook: string | null; instagram: string | null; linkedin: string | null; youtube: string | null; googleMaps: string | null;
  seoTitle: string | null; seoDesc: string | null; seoKeywords: string | null; googleAnalyticsId: string | null;
}
interface Product { id: string; name: string; description?: string; price?: string; category?: string }
interface WebsiteTheme { id: string; name: string; industry: string | null; cssVars: Record<string, string>; isDefault: boolean }

const EMPTY: VendorCms = {
  businessName: '', tagline: '', about: '', logo: '', banner: '', themeId: '', phone: '', whatsapp: '', email: '', address: '',
  facebook: '', instagram: '', linkedin: '', youtube: '', googleMaps: '',
  seoTitle: '', seoDesc: '', seoKeywords: '', googleAnalyticsId: '',
};

const field = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';

export default function WebsiteManagerPage() {
  const { user } = useAuth();
  const cfg = useDashboardConfig(user?.industry);
  const [tab, setTab] = useState<Tab>('basic');
  const [cms, setCms] = useState<VendorCms>(EMPTY);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [newProduct, setNewProduct] = useState<Partial<Product>>({});
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const [themes, setThemes] = useState<WebsiteTheme[]>([]);

  useEffect(() => {
    const q = user?.industry ? `?industry=${encodeURIComponent(user.industry)}` : '';
    api.websiteThemes(q).then((res) => setThemes(res.data ?? [])).catch(() => setThemes([]));
  }, [user?.industry]);

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
      if (res.data) setCms({ ...EMPTY, ...res.data, businessName: res.data.businessName ?? user.businessName ?? '' });
    }).catch(() => {}).finally(() => setLoading(false));
    api.getVendorProducts(user.id).then((res) => setProducts(res.data ?? [])).catch(() => setProducts([]));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof VendorCms, v: string) => setCms((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!user) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.updateVendorCMS(user.id, cms);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const addProduct = async () => {
    if (!user || !newProduct.name) return;
    const res = await api.addProduct(user.id, newProduct);
    setProducts((p) => [...p, res.data]);
    setNewProduct({});
  };
  const deleteProduct = async (id: string) => {
    await api.deleteProduct(id);
    setProducts((p) => p.filter((x) => x.id !== id));
  };

  const copyUrl = () => { navigator.clipboard.writeText(subdomainUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'branding', label: 'Logo & Banner' },
    { key: 'about', label: 'About & Social' },
    { key: 'services', label: cfg.industry?.entities.catalogItem.labelPlural ?? 'Services' },
    { key: 'seo', label: 'SEO' },
    { key: 'template', label: 'Template' },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Website Manager</h1>
          <p className="text-sm text-slate-500">Edit your site content — templates are handled for you.</p>
        </div>
        {previewUrl && (
          <div className="flex items-center gap-2">
            <a href={previewUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Preview my site</Button></a>
            <Button size="sm" variant="ghost" leftIcon={copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />} onClick={copyUrl}>{copied ? 'Copied' : 'Copy URL'}</Button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}

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

        {tab === 'seo' && (
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">SEO Title</label><input className={field} value={cms.seoTitle ?? ''} onChange={(e) => set('seoTitle', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Meta Description</label><textarea rows={2} className={field} value={cms.seoDesc ?? ''} onChange={(e) => set('seoDesc', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Keywords (comma separated)</label><input className={field} value={cms.seoKeywords ?? ''} onChange={(e) => set('seoKeywords', e.target.value)} /></div>
            <div><label className="mb-1.5 block text-xs font-medium text-slate-600">Google Analytics ID</label><input className={field} placeholder="G-XXXXXXX" value={cms.googleAnalyticsId ?? ''} onChange={(e) => set('googleAnalyticsId', e.target.value)} /></div>
          </div>
        )}

        {tab === 'services' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {products.length === 0 ? <p className="text-sm text-slate-400">No items yet.</p> : products.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div><div className="text-sm font-semibold text-slate-900">{p.name}</div>{p.price && <div className="text-xs text-slate-500">₹{p.price}</div>}</div>
                  <button onClick={() => deleteProduct(p.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={field} placeholder="Name" value={newProduct.name ?? ''} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                <input className={field} placeholder="Price" value={newProduct.price ?? ''} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={addProduct} disabled={!newProduct.name}>Add</Button>
              </div>
            </div>
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
                    return (
                      <button key={t.id} type="button" onClick={() => set('themeId', t.id)}
                        className={`rounded-xl border-2 p-3 text-left transition-colors ${selected ? 'border-primary-500 bg-primary-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="h-6 w-6 rounded-md" style={{ background: primary }} />
                          <span className="h-6 w-6 rounded-md" style={{ background: accent }} />
                          <span className="ml-auto text-xs font-semibold text-slate-500">{selected ? 'Selected' : t.isDefault ? 'Default' : ''}</span>
                        </div>
                        <div className="mt-2 text-sm font-bold text-slate-900">{t.name}</div>
                      </button>
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
