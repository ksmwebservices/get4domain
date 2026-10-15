'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, History, Image as ImageIcon, Loader2, Plus, Rocket, Save, Trash2, Undo2, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { CMS_EDITABLE, editable } from '@/lib/editable';
import { useAuth } from '@/lib/auth-context';
import { useWebsiteSection, WEBSITE_SECTION_TABS } from '@/dashboard-v2/section-context';
import { ItemsTab, PageContentTab, SamplePanel, TemplateTab, type DesignsView, type Extras, type SampleSummary } from './SiteContentTabs';
import { SITE_THEME_LIST, VARIANTS } from '@/engine/sitedoc/build';

type Doc = Record<string, unknown> & { portfolio?: { id: string; src: string; title?: string; category?: string }[]; testimonials?: { quote: string; author: string; note?: string; sample?: boolean }[]; pages?: { slug: string; title: string; body: string }[]; layout?: Record<string, string>; extras?: Extras; designKey?: string };
interface View { enabled: boolean; plan: string; limits: { pages: number; mediaMb: number }; usage: { pages: number; mediaBytes: number }; subdomain: string | null; publicUrl: string | null; live: Doc; doc: Doc; dirty: boolean; version: number; publishedAt: string | null; siteStatus?: string; sample?: SampleSummary }
interface Version { version: number; note: string | null; createdAt: string; createdBy: string | null; current: boolean }
type Tab = 'basic' | 'content' | 'items' | 'branding' | 'template' | 'about' | 'portfolio' | 'testimonials' | 'pages' | 'seo' | 'design';

const field = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';
const lbl = 'mb-1.5 block text-xs font-medium text-slate-600';
const TEXT_FIELDS = ['businessName', 'tagline', 'about', 'logo', 'banner', 'favicon', 'ogImage', 'seoTitle', 'seoDesc', 'seoKeywords', 'googleAnalyticsId', 'phone', 'whatsapp', 'email', 'address', 'businessHours', 'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps', 'designKey'];
const JSON_FIELDS = ['portfolio', 'testimonials', 'pages', 'layout', 'extras'];
const SLOT_LABEL: Record<string, string> = { hero: 'Top of the page', about: 'About', services: 'Your items', gallery: 'Gallery', testimonials: 'Customer quotes', contact: 'Contact' };
const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;
const slugOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

/** The new Website Manager: edit a draft, preview it, publish it, go back to an earlier version. Every plan has all of it; plans limit pages and picture storage. */
export default function SiteEditorV2({ initial }: { initial: View }) {
  const section = useWebsiteSection();
  const { user } = useAuth();
  const [designs, setDesigns] = useState<DesignsView | null>(null);
  const [view, setView] = useState<View>(initial);
  const [doc, setDoc] = useState<Doc>(initial.doc);
  const [saved, setSaved] = useState<Doc>(initial.doc);
  const [tab, setTab] = useState<Tab>(section === 'design' ? 'template' : section === 'search' ? 'seo' : 'basic');
  const [busy, setBusy] = useState<'' | 'save' | 'publish' | 'preview' | 'discard' | 'upload' | 'generate'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cats, setCats] = useState<{ key: string; name: string }[]>([]);
  const [gen, setGen] = useState({ packKey: '', businessName: String(initial.doc.businessName ?? ''), city: '', phone: String(initial.doc.phone ?? '') });

  const set = (k: string, v: unknown): void => setDoc((d) => ({ ...d, [k]: v }));
  const changes = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of [...TEXT_FIELDS, ...JSON_FIELDS]) if (JSON.stringify(doc[f] ?? null) !== JSON.stringify(saved[f] ?? null)) out[f] = doc[f] ?? (JSON_FIELDS.includes(f) ? (f === 'layout' || f === 'extras' ? {} : []) : '');
    return out;
  }, [doc, saved]);
  const hasLocal = Object.keys(changes).length > 0;
  const unpublished = view.dirty || hasLocal;

  const accept = (v: View): void => { setView(v); setDoc(v.doc); setSaved(v.doc); };
  const fail = (e: unknown): void => setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');

  useEffect(() => { api.siteDocCategories().then((r) => setCats((r.data ?? []) as { key: string; name: string }[])).catch(() => setCats([])); }, []);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!hasLocal) return true;
    setBusy('save'); setError(''); setNotice('');
    try { const r = await api.siteDocSave(editable(changes, [...CMS_EDITABLE, 'portfolio', 'testimonials', 'pages'])); accept(r.data as View); setNotice('Draft saved. Your public site has not changed yet.'); return true; } catch (e) { fail(e); return false; } finally { setBusy(''); }
  }, [changes, hasLocal]);

  const preview = async (): Promise<void> => {
    if (!(await saveDraft())) return;
    setBusy('preview'); setError('');
    try { const r = await api.siteDocPreview(); const url = (r.data as { url: string }).url; setPreviewUrl(url); if (tab !== 'design') window.open(url, '_blank', 'noopener'); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const publish = async (): Promise<void> => {
    if (!(await saveDraft())) return;
    setBusy('publish'); setError(''); setNotice('');
    try { const r = await api.siteDocPublish(); const d = r.data as { view: View; message: string }; accept(d.view); setNotice(`Published. ${d.message}`); setPreviewUrl(''); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const discard = async (): Promise<void> => {
    if (!window.confirm('Throw away all changes that are not published yet?')) return;
    setBusy('discard'); setError('');
    try { const r = await api.siteDocDiscard(); accept(r.data as View); setNotice('Unpublished changes were discarded.'); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const openVersions = async (): Promise<void> => { try { const r = await api.siteDocVersions(); setVersions((r.data ?? []) as Version[]); } catch (e) { fail(e); } };
  const restore = async (v: Version): Promise<void> => {
    if (!window.confirm(`Put version ${v.version} live again? Your current site is kept as a version too.`)) return;
    setBusy('publish'); setError('');
    try { const r = await api.siteDocRestore(v.version); const d = r.data as { view: View; message: string }; accept(d.view); setVersions(null); setNotice(`Version ${v.version} is live again. ${d.message}`); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const upload = async (kind: 'LOGO' | 'BANNER' | 'GALLERY' | 'ABOUT', file: File, then: (url: string, extra?: { favicon?: string; ogImage?: string }) => void): Promise<void> => {
    setBusy('upload'); setError('');
    try { const r = await api.uploadImage(file, kind); const d = r.data; if (!d?.url) throw new Error('The picture could not be uploaded. Please try again.'); then(d.url, { favicon: d.favicon, ogImage: d.ogImage }); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const generate = async (): Promise<void> => {
    if (!gen.packKey || !gen.businessName.trim()) { setError('Choose your category and enter your business name.'); return; }
    setBusy('generate'); setError('');
    try { const r = await api.siteDocGenerate({ packKey: gen.packKey, businessName: gen.businessName.trim(), city: gen.city.trim() || undefined, phone: gen.phone.trim() || undefined }); accept(r.data as View); setNotice('Your site is ready as a draft. Check each tab, press Preview, then Publish.'); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const loadDesigns = useCallback(async (): Promise<void> => {
    try { const r = await api.siteDocDesigns(); setDesigns(r.data as DesignsView); } catch { setDesigns({ packKey: null, family: null, current: null, defaultDesign: null, designs: [] }); }
  }, []);
  useEffect(() => { void loadDesigns(); }, [loadDesigns]);

  // the private preview address the four design thumbnails use; a fresh one after every save
  const [designBase, setDesignBase] = useState('');
  const refreshDesignBase = useCallback(async (): Promise<void> => {
    if (!(await saveDraft())) return;
    try { const r = await api.siteDocPreview(); setDesignBase((r.data as { url: string }).url); } catch (e) { fail(e); }
  }, [saveDraft]);
  useEffect(() => { if (tab === 'template' && !designBase) void refreshDesignBase(); }, [tab, designBase, refreshDesignBase]);

  const pickDesign = async (key: string): Promise<void> => {
    if (!(await saveDraft())) return;
    setBusy('save'); setError('');
    try { const r = await api.siteDocSetDesign(key); accept(r.data as View); setNotice('Design changed in your draft. Your words, items and pictures are unchanged. Press Publish to put it live.'); await loadDesigns(); setDesignBase(''); } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const resetStarter = async (): Promise<void> => {
    if (!(await saveDraft())) return;
    setBusy('generate'); setError('');
    try { const r = await api.siteDocResetStarter(); accept((r.data as { view: View }).view); setNotice('Starter content added where something was empty or still sample. Nothing you wrote was changed. Check it, then Publish.'); } catch (e) { fail(e); } finally { setBusy(''); }
  };

  const tabs: { key: Tab; label: string }[] = ([
    { key: 'basic', label: 'Basic Info' }, { key: 'content', label: 'Page content' }, { key: 'items', label: 'Items' }, { key: 'branding', label: 'Logo & Banner' }, { key: 'template', label: 'Template' }, { key: 'about', label: 'About & Social' }, { key: 'portfolio', label: 'Portfolio' },
    { key: 'testimonials', label: 'Customer quotes' }, { key: 'pages', label: 'Pages' }, { key: 'seo', label: 'SEO' }, { key: 'design', label: 'Theme & layout' },
  ] as { key: Tab; label: string }[]).filter((t) => !section || (WEBSITE_SECTION_TABS[section] ?? []).includes(t.key));

  const text = (k: string, label: string, opts: { area?: boolean; wide?: boolean; hint?: string } = {}) => (
    <div className={opts.wide ? 'sm:col-span-2' : ''}>
      <label className={lbl}>{label}{opts.hint && <span className="text-slate-400"> — {opts.hint}</span>}</label>
      {opts.area ? <textarea rows={4} className={field} value={String(doc[k] ?? '')} onChange={(e) => set(k, e.target.value)} /> : <input className={field} value={String(doc[k] ?? '')} onChange={(e) => set(k, e.target.value)} />}
    </div>
  );
  const picker = (kind: 'LOGO' | 'BANNER', k: 'logo' | 'banner', label: string, hint: string) => (
    <div>
      <label className={lbl}>{label} <span className="text-slate-400">— {hint}</span></label>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {doc[k] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={String(doc[k])} alt={label} className={kind === 'LOGO' ? 'h-28 w-full bg-slate-50 object-contain p-3' : 'h-40 w-full object-cover'} /> : <div className="flex h-28 w-full items-center justify-center bg-slate-100 text-slate-400"><ImageIcon className="h-8 w-8" /></div>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {busy === 'upload' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{doc[k] ? 'Change' : 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(kind, f, (url, x) => { set(k, url); if (kind === 'LOGO') { if (x?.favicon) set('favicon', x.favicon); if (x?.ogImage) set('ogImage', x.ogImage); } }); }} />
        </label>
        {doc[k] ? <button type="button" className="text-xs text-slate-500 underline" onClick={() => set(k, '')}>Remove</button> : null}
        <span className="text-xs text-slate-400">PNG, JPG or WebP, up to 5 MB</span>
      </div>
    </div>
  );

  const layout = (doc.layout ?? {}) as Record<string, string>;
  const setLayout = (k: string, v: string): void => set('layout', { ...layout, [k]: v });
  const pages = doc.pages ?? [];
  const portfolio = doc.portfolio ?? [];
  const quotes = doc.testimonials ?? [];
  const notStarted = !String(doc.businessName ?? '').trim() && !view.live.tagline && !(view.live.packKey);

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Website Manager</h1>
          <p className="text-sm text-slate-500">
            {unpublished ? <span className="font-medium text-amber-700">You have changes that are not live yet.</span> : <span className="inline-flex items-center gap-1 text-success-700"><CheckCircle2 className="h-4 w-4" /> Your site is up to date{view.version ? ` (version ${view.version})` : ''}.</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" leftIcon={<History className="h-3.5 w-3.5" />} onClick={() => void openVersions()}>Versions</Button>
          <Button size="sm" variant="outline" leftIcon={busy === 'preview' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} onClick={() => void preview()} disabled={!!busy}>Preview my site</Button>
          <Button size="sm" variant="outline" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={() => void saveDraft()} disabled={!hasLocal || !!busy} loading={busy === 'save'}>Save draft</Button>
          <Button size="sm" leftIcon={<Rocket className="h-3.5 w-3.5" />} onClick={() => void publish()} disabled={!unpublished || !!busy} loading={busy === 'publish'}>Publish</Button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{notice}</div>}
      {view.dirty && !hasLocal && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><span>A saved draft is waiting. Press Publish to put it live.</span><button type="button" className="inline-flex items-center gap-1 underline" onClick={() => void discard()}><Undo2 className="h-3.5 w-3.5" />Discard</button></div>}

      {notStarted && cats.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Start from your category</h2>
          <p className="mt-1 text-sm text-slate-500">Choose what kind of business you run and enter your details. We write the first version of your site; you then change anything you like.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Category</label><select className={field} value={gen.packKey} onChange={(e) => setGen({ ...gen, packKey: e.target.value })}><option value="">Choose</option>{cats.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
            <div><label className={lbl}>Business name</label><input className={field} value={gen.businessName} onChange={(e) => setGen({ ...gen, businessName: e.target.value })} /></div>
            <div><label className={lbl}>City</label><input className={field} value={gen.city} onChange={(e) => setGen({ ...gen, city: e.target.value })} /></div>
            <div><label className={lbl}>Phone</label><input className={field} value={gen.phone} onChange={(e) => setGen({ ...gen, phone: e.target.value })} /></div>
          </div>
          <div className="mt-3"><Button size="sm" onClick={() => void generate()} loading={busy === 'generate'}>Create my site</Button></div>
        </Card>
      )}

      {view.sample && <SamplePanel sample={view.sample} onGo={(t) => setTab(t as Tab)} onReset={() => void resetStarter()} busy={busy === 'generate'} />}
      {view.siteStatus && view.siteStatus !== 'LIVE' && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">Your site is not visible to the public yet. It goes live when you press Publish.</div>}

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.key ? 'bg-primary-50 text-primary-700' : 'text-slate-500'}`}>{t.label}</button>)}
      </div>

      <Card>
        {tab === 'basic' && <div className="grid gap-4 sm:grid-cols-2">{text('businessName', 'Business name')}{text('tagline', 'Tagline')}{text('phone', 'Phone')}{text('whatsapp', 'WhatsApp')}{text('email', 'E-mail')}{text('address', 'Address')}{text('businessHours', 'Opening hours', { wide: true, hint: 'for example Mon to Sat, 9 am to 6 pm' })}</div>}
        {tab === 'branding' && <div className="space-y-6">{picker('BANNER', 'banner', 'Banner picture', 'the photo at the top of your site. Without one, your theme colours are used.')}{picker('LOGO', 'logo', 'Logo', 'a PNG keeps its transparent background. A browser-tab icon and a share picture are made from it.')}</div>}
        {tab === 'about' && <div className="grid gap-4 sm:grid-cols-2">{text('about', 'About your business', { area: true, wide: true })}{text('facebook', 'Facebook')}{text('instagram', 'Instagram')}{text('linkedin', 'LinkedIn')}{text('youtube', 'YouTube')}{text('googleMaps', 'Google Maps link', { wide: true })}</div>}
        {tab === 'portfolio' && (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {portfolio.map((p, i) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.title ?? ''} className="h-28 w-full object-cover" />
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="truncate text-xs text-slate-500">{p.title || `Picture ${i + 1}`}</span>
                    <button type="button" aria-label="Remove picture" className="text-slate-400 hover:text-error-600" onClick={() => set('portfolio', portfolio.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add a picture
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload('GALLERY', f, (url) => set('portfolio', [...portfolio, { id: `${Date.now()}`, src: url, title: '', category: '' }])); }} />
            </label>
            <p className="mt-2 text-xs text-slate-500">These pictures show as the gallery on your site.</p>
          </div>
        )}
        {tab === 'content' && <PageContentTab extras={(doc.extras ?? {}) as Extras} set={(next) => set('extras', next)} />}
        {tab === 'items' && user?.id && <ItemsTab vendorId={user.id} noun={'item'} itemFields={designs?.itemFields ?? []} onChanged={() => void api.siteDoc().then((r) => accept(r.data as View))} />}
        {tab === 'template' && <TemplateTab view={designs} previewBase={designBase} onPick={(k) => void pickDesign(k)} busy={busy === 'save'} onRefresh={() => { setDesignBase(''); }} />}
        {tab === 'testimonials' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Add real quotes from customers who agreed to be named. Quotes marked Sample are examples: they are never shown to the public. Replace each one with a real quote.</p>
            {quotes.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_12rem_auto]">
                <textarea rows={2} className={field} placeholder="What they said" value={q.quote} maxLength={600} onChange={(e) => set('testimonials', quotes.map((x, j) => (j === i ? { ...x, quote: e.target.value, sample: undefined } : x)))} />
                <input className={field} placeholder={q.sample ? 'Sample: not shown to the public' : 'Name'} value={q.author} maxLength={120} onChange={(e) => set('testimonials', quotes.map((x, j) => (j === i ? { ...x, author: e.target.value, sample: undefined } : x)))} />
                <button type="button" aria-label="Remove" className="text-slate-400 hover:text-error-600" onClick={() => set('testimonials', quotes.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {quotes.length < 12 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => set('testimonials', [...quotes, { quote: '', author: '' }])}>Add a quote</Button>}
          </div>
        )}
        {tab === 'pages' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Your plan includes {view.limits.pages} page{view.limits.pages === 1 ? '' : 's'} (the home page counts as one). You are using {1 + pages.length}.</p>
            {pages.map((p, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex gap-2">
                  <input className={field} placeholder="Page title" value={p.title} maxLength={120} onChange={(e) => set('pages', pages.map((x, j) => (j === i ? { ...x, title: e.target.value, slug: x.slug && x.slug !== slugOf(x.title) ? x.slug : slugOf(e.target.value) } : x)))} />
                  <button type="button" aria-label="Remove page" className="text-slate-400 hover:text-error-600" onClick={() => set('pages', pages.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea rows={5} className={field} placeholder="Page text" value={p.body} maxLength={8000} onChange={(e) => set('pages', pages.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                <p className="text-xs text-slate-400">Address: /p/{p.slug || '...'}</p>
              </div>
            ))}
            {1 + pages.length < view.limits.pages
              ? <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => set('pages', [...pages, { slug: '', title: '', body: '' }])}>Add a page</Button>
              : <p className="text-sm text-amber-800">You have reached the pages in your plan. Upgrade your plan to add more. Nothing you made is removed.</p>}
          </div>
        )}
        {tab === 'seo' && <div className="grid gap-4">{text('seoTitle', 'SEO title')}{text('seoDesc', 'Meta description', { area: true })}{text('seoKeywords', 'Keywords (comma separated)')}{text('googleAnalyticsId', 'Google Analytics ID', { hint: 'for example G-XXXXXXX' })}</div>}
        {tab === 'design' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Theme</h2>
              <p className="text-xs text-slate-500">Colours and fonts. Changing the theme never changes your content.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {SITE_THEME_LIST.map((t) => {
                  const on = (layout.themeKey || '') === t.id;
                  return (
                    <button key={t.id} type="button" onClick={() => setLayout('themeKey', t.id)} aria-pressed={on} className={`rounded-xl border p-3 text-left ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'}`}>
                      <div className="flex h-12 items-end gap-1 rounded-lg p-1.5" style={{ background: t.bg }}><span className="h-3 w-8 rounded" style={{ background: t.accent }} /><span className="h-2 w-5 rounded" style={{ background: t.fg, opacity: 0.6 }} /></div>
                      <div className="mt-2 text-xs font-semibold text-slate-800">{t.label}</div>
                      <div className="text-[11px] text-slate-500">{t.mode === 'dark' ? 'Dark' : 'Light'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Layouts</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(VARIANTS).map(([slot, opts]) => (
                  <div key={slot}><label className={lbl}>{SLOT_LABEL[slot] ?? slot}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {opts.map((o) => <button key={o} type="button" onClick={() => setLayout(slot, o)} aria-pressed={layout[slot] === o} className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${layout[slot] === o ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600'}`}>{o}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Your site, with your own content</h2><Button size="sm" variant="outline" onClick={() => void preview()} disabled={!!busy}>Refresh preview</Button></div>
              {previewUrl ? <iframe title="Preview of your site" src={previewUrl} className="mt-3 h-[520px] w-full rounded-xl border border-slate-200 bg-white" /> : <p className="mt-2 text-sm text-slate-500">Press Refresh preview to see your site with the choices above. It is private until you publish.</p>}
            </div>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-slate-500">Pictures stored: {mb(view.usage.mediaBytes)} of {view.limits.mediaMb} MB in your plan.{view.publicUrl ? <> Your site: <a className="underline" href={view.publicUrl} target="_blank" rel="noopener noreferrer">{view.publicUrl}</a></> : null}</p>

      <Modal isOpen={versions !== null} onClose={() => setVersions(null)} title="Earlier versions of your site" maxWidth="max-w-lg">
        <div className="space-y-2">
          {(versions ?? []).length === 0 && <p className="text-sm text-slate-500">Nothing yet. A version is saved every time you publish; the last 10 are kept.</p>}
          {(versions ?? []).map((v) => (
            <div key={v.version} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              <div><div className="font-medium text-slate-800">Version {v.version}{v.current ? ' (live now)' : ''}</div><div className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString('en-IN')} · {v.note ?? ''}</div></div>
              {!v.current && <Button size="sm" variant="outline" onClick={() => void restore(v)}>Put this live</Button>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
