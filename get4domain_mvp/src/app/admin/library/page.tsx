'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Sparkles, Palette, FileText, Lock } from 'lucide-react';
import { api } from '@/lib/api';

// Admin Content Library — one place for all template kinds (AI prompt, pick-and-
// fill design templates, business documents) plus website themes. The "Templates"
// tab is a single list filterable by type, not disconnected screens.
type Tab = 'templates' | 'themes';
// Two vendor-facing template kinds: 'prompt' feeds AI Generate; 'template' is the
// pick-and-fill library (synced design templates + business documents). No provider
// branding — the design provider stays out of the UI.
type TypeFilter = 'all' | 'prompt' | 'template';

interface AiTemplate { id: string; name: string; contentType: string; industry: string | null; prompt: string; thumbnail: string | null; source: string; canvaTemplateId: string | null; active: boolean }
interface DocBuiltin { key: string; label: string; description: string; fields: { key: string; label: string }[] }
interface WebsiteTheme { id: string; name: string; industry: string | null; cssVars: Record<string, string>; preview: string | null; isDefault: boolean; active: boolean }

const CONTENT_TYPES = ['social_post', 'festival_poster', 'blog_post', 'ad_creative', 'email', 'whatsapp', 'sms', 'document'];
const INDUSTRIES = ['', 'travel', 'restaurant', 'clinic', 'hotel', 'salon', 'gym', 'realestate', 'education', 'retail', 'construction', 'events', 'finance', 'automobile', 'logistics', 'diagnostics', 'photography', 'professional', 'agriculture', 'coaching', 'technology'];

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none';

// Badge per row. 'prompt' → AI Prompt; anything else (synced design templates,
// business documents) shows under the single "AI Template" category.
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  prompt: { label: 'AI Prompt', cls: 'bg-primary-500/15 text-primary-300' },
  canva: { label: 'AI Template', cls: 'bg-violet-500/15 text-violet-300' },
  document: { label: 'AI Template', cls: 'bg-violet-500/15 text-violet-300' },
};

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prompt', label: 'AI Prompt' },
  { key: 'template', label: 'AI Template' },
];

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<Tab>('templates');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [docBuiltins, setDocBuiltins] = useState<DocBuiltin[]>([]);
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
      const [t, th, docs] = await Promise.all([api.aiTemplatesAll(), api.websiteThemesAll(), api.businessDocTemplates()]);
      setTemplates(t.data ?? []);
      setThemes(th.data ?? []);
      setDocBuiltins(docs.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addTemplate() {
    if (!tpl.name || !tpl.prompt) return;
    setSavingT(true); setError('');
    try {
      // The only admin-createable template kind is AI prompt — design templates are
      // synced from the provider, business documents are coded. So source is 'prompt'.
      await api.createAiTemplate({ name: tpl.name, contentType: tpl.contentType, industry: tpl.industry || undefined, prompt: tpl.prompt, thumbnail: tpl.thumbnail || undefined, source: 'prompt' });
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

  // 'prompt' rows are AI-prompt templates; every other source (synced design
  // templates, etc.) + the coded business documents make up the "AI Template" kind.
  const visibleTemplates = templates.filter((t) => {
    const src = t.source ?? 'prompt';
    if (typeFilter === 'all') return true;
    if (typeFilter === 'prompt') return src === 'prompt';
    return src !== 'prompt'; // 'template'
  });
  const showDocs = typeFilter === 'all' || typeFilter === 'template';
  const showCreate = typeFilter === 'all' || typeFilter === 'prompt';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Content Library</h2>
        <p className="mt-1 text-sm text-slate-400">AI prompt templates and pick-and-fill templates (including business documents), plus website themes.</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 w-fit">
        {(['templates', 'themes'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'text-slate-400'}`}>
            {t === 'templates' ? <Sparkles className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}{t === 'templates' ? 'Templates' : 'Website Themes'}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div> : tab === 'templates' ? (
        <div className="space-y-4">
          {/* Type filter — one list across all three template kinds */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${typeFilter === f.key ? 'bg-primary-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {showCreate && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-bold text-white">New AI prompt template</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputCls} placeholder="Name" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
                <select className={inputCls} value={tpl.contentType} onChange={(e) => setTpl({ ...tpl, contentType: e.target.value })}>{CONTENT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <select className={inputCls} value={tpl.industry} onChange={(e) => setTpl({ ...tpl, industry: e.target.value })}>{INDUSTRIES.map((i) => <option key={i} value={i}>{i || 'All industries'}</option>)}</select>
                <input className={inputCls} placeholder="Thumbnail URL (optional)" value={tpl.thumbnail} onChange={(e) => setTpl({ ...tpl, thumbnail: e.target.value })} />
              </div>
              <textarea className={`${inputCls} mt-2`} rows={3} placeholder="Base prompt / design brief the vendor starts from" value={tpl.prompt} onChange={(e) => setTpl({ ...tpl, prompt: e.target.value })} />
              <button onClick={addTemplate} disabled={savingT || !tpl.name || !tpl.prompt} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{savingT ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add template</button>
            </div>
          )}

          {/* One list — AI-prompt + design templates (DB rows) and business documents together */}
          <div className="space-y-2">
            {visibleTemplates.map((t) => {
              const meta = SOURCE_META[t.source ?? 'prompt'] ?? SOURCE_META.prompt;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                      {t.name} <span className="text-xs font-normal text-slate-500">· {t.contentType} · {t.industry ?? 'all'}</span>
                    </div>
                    <div className="truncate text-xs text-slate-500">{t.source && t.source !== 'prompt' ? `Design template ${t.canvaTemplateId ?? ''}` : t.prompt}</div>
                  </div>
                  <button onClick={() => delTemplate(t.id)} className="ml-3 rounded-lg p-2 text-slate-500 hover:bg-error-500/10 hover:text-error-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}

            {/* Business documents — coded built-ins, folded into the same AI Template list */}
            {showDocs && docBuiltins.map((d) => (
              <div key={d.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SOURCE_META.document.cls}`}>{SOURCE_META.document.label}</span>
                    <FileText className="h-3.5 w-3.5 text-slate-500" />{d.label}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500"><Lock className="h-3 w-3" />Built-in</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">{d.description} · fields: {d.fields.map((f) => f.label).join(', ')}</div>
                </div>
              </div>
            ))}

            {visibleTemplates.length === 0 && !(showDocs && docBuiltins.length) && (
              <p className="text-sm text-slate-500">No templates yet.</p>
            )}
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
