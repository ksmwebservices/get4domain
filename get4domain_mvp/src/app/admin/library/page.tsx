'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Sparkles, Palette } from 'lucide-react';
import { api } from '@/lib/api';

// Admin management for the AI template library (2.2) and website themes (2.3).
type Tab = 'templates' | 'themes';

interface AiTemplate { id: string; name: string; contentType: string; industry: string | null; prompt: string; thumbnail: string | null; active: boolean }
interface WebsiteTheme { id: string; name: string; industry: string | null; cssVars: Record<string, string>; preview: string | null; isDefault: boolean; active: boolean }

const CONTENT_TYPES = ['social_post', 'festival_poster', 'blog_post', 'ad_creative', 'email', 'whatsapp', 'sms', 'document'];
const INDUSTRIES = ['', 'travel', 'restaurant', 'clinic', 'hotel', 'salon', 'gym', 'realestate', 'education', 'retail', 'construction', 'events', 'finance', 'automobile', 'logistics', 'diagnostics', 'photography', 'professional', 'agriculture', 'coaching', 'technology'];

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none';

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<Tab>('templates');
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [themes, setThemes] = useState<WebsiteTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingT, setSavingT] = useState(false);
  const [savingTh, setSavingTh] = useState(false);

  const [tpl, setTpl] = useState({ name: '', contentType: CONTENT_TYPES[0], industry: '', prompt: '', thumbnail: '' });
  const [theme, setTheme] = useState({ name: '', industry: '', primary: '#2563eb', accent: '#3b82f6', radius: '16px', preview: '', isDefault: false });

  async function load() {
    setLoading(true);
    try {
      const [t, th] = await Promise.all([api.aiTemplatesAll(), api.websiteThemesAll()]);
      setTemplates(t.data ?? []);
      setThemes(th.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addTemplate() {
    if (!tpl.name || !tpl.prompt) return;
    setSavingT(true); setError('');
    try {
      await api.createAiTemplate({ name: tpl.name, contentType: tpl.contentType, industry: tpl.industry || undefined, prompt: tpl.prompt, thumbnail: tpl.thumbnail || undefined });
      setTpl({ name: '', contentType: CONTENT_TYPES[0], industry: '', prompt: '', thumbnail: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setSavingT(false); }
  }
  async function addTheme() {
    if (!theme.name) return;
    setSavingTh(true); setError('');
    try {
      await api.createWebsiteTheme({ name: theme.name, industry: theme.industry || undefined, isDefault: theme.isDefault, preview: theme.preview || undefined, cssVars: { '--primary': theme.primary, '--accent': theme.accent, '--radius': theme.radius } });
      setTheme({ name: '', industry: '', primary: '#2563eb', accent: '#3b82f6', radius: '16px', preview: '', isDefault: false });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setSavingTh(false); }
  }
  async function delTemplate(id: string) { await api.deleteAiTemplate(id).catch(() => {}); await load(); }
  async function delTheme(id: string) { await api.deleteWebsiteTheme(id).catch(() => {}); await load(); }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Content Library</h2>
        <p className="mt-1 text-sm text-slate-400">Prebuilt AI templates and website themes vendors can use.</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 w-fit">
        {(['templates', 'themes'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>
            {t === 'templates' ? <Sparkles className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}{t === 'templates' ? 'AI Templates' : 'Website Themes'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : tab === 'templates' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-bold text-white">New AI template</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Name" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
              <select className={inputCls} value={tpl.contentType} onChange={(e) => setTpl({ ...tpl, contentType: e.target.value })}>{CONTENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select className={inputCls} value={tpl.industry} onChange={(e) => setTpl({ ...tpl, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i || 'All industries'}</option>)}</select>
              <input className={inputCls} placeholder="Thumbnail URL (optional)" value={tpl.thumbnail} onChange={(e) => setTpl({ ...tpl, thumbnail: e.target.value })} />
            </div>
            <textarea className={`${inputCls} mt-2`} rows={3} placeholder="Base prompt / design brief the vendor starts from" value={tpl.prompt} onChange={(e) => setTpl({ ...tpl, prompt: e.target.value })} />
            <button onClick={addTemplate} disabled={savingT || !tpl.name || !tpl.prompt} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{savingT ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add template</button>
          </div>
          <div className="space-y-2">
            {templates.length === 0 ? <p className="text-sm text-slate-500">No templates yet.</p> : templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{t.name} <span className="text-xs font-normal text-slate-500">· {t.contentType} · {t.industry ?? 'all'}</span></div>
                  <div className="truncate text-xs text-slate-500">{t.prompt}</div>
                </div>
                <button onClick={() => delTemplate(t.id)} className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-error-500/10 hover:text-error-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 text-sm font-bold text-white">New website theme</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Name" value={theme.name} onChange={(e) => setTheme({ ...theme, name: e.target.value })} />
              <select className={inputCls} value={theme.industry} onChange={(e) => setTheme({ ...theme, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i || 'Any industry'}</option>)}</select>
              <label className="flex items-center gap-2 text-sm text-slate-300">Primary <input type="color" value={theme.primary} onChange={(e) => setTheme({ ...theme, primary: e.target.value })} className="h-8 w-12 rounded border border-slate-700 bg-slate-900" /></label>
              <label className="flex items-center gap-2 text-sm text-slate-300">Accent <input type="color" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="h-8 w-12 rounded border border-slate-700 bg-slate-900" /></label>
              <input className={inputCls} placeholder="Radius (e.g. 16px)" value={theme.radius} onChange={(e) => setTheme({ ...theme, radius: e.target.value })} />
              <input className={inputCls} placeholder="Preview thumbnail URL (optional)" value={theme.preview} onChange={(e) => setTheme({ ...theme, preview: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={theme.isDefault} onChange={(e) => setTheme({ ...theme, isDefault: e.target.checked })} /> Default for this industry</label>
            </div>
            <p className="mt-2 text-xs text-slate-500">Add several themes per industry — each with its own preview thumbnail — so vendors pick from a set, not one fixed look. Templates can be sourced from Bolt-built designs (upload the preview here).</p>
            <button onClick={addTheme} disabled={savingTh || !theme.name} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{savingTh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add theme</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.length === 0 ? <p className="text-sm text-slate-500">No themes yet.</p> : themes.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                {t.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.preview} alt={`${t.name} preview`} className="mb-2 h-28 w-full rounded-lg object-cover ring-1 ring-slate-800" />
                )}
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-md" style={{ background: t.cssVars?.['--primary'] ?? '#2563eb' }} />
                  <span className="h-6 w-6 rounded-md" style={{ background: t.cssVars?.['--accent'] ?? '#3b82f6' }} />
                  <button onClick={() => delTheme(t.id)} className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-error-500/10 hover:text-error-400"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 text-sm font-bold text-white">{t.name} {t.isDefault && <span className="text-xs font-normal text-success-400">· default</span>}</div>
                <div className="text-xs text-slate-500">{t.industry ?? 'any industry'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
