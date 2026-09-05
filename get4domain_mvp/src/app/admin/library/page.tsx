'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Loader2, Sparkles, Palette, FileText, Lock } from 'lucide-react';
import { api } from '@/lib/api';

// Fabric.js editor is browser-only — used here in admin (authoring) mode.
const FabricEditor = dynamic(() => import('@/components/design/FabricEditor'), {
  ssr: false,
  loading: () => <div className="flex h-[70vh] items-center justify-center text-sm text-slate-400">Loading editor…</div>,
});

// Design-template categories + canvas size presets for admin authoring.
const DESIGN_CATEGORIES = ['poster', 'business_card', 'flyer', 'brochure', 'social_graphic'];
const SIZE_PRESETS: Record<string, { w: number; h: number }> = {
  poster: { w: 1080, h: 1080 },
  business_card: { w: 1050, h: 600 },
  flyer: { w: 1080, h: 1350 },
  brochure: { w: 1080, h: 1080 },
  social_graphic: { w: 1080, h: 1080 },
};

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
interface DesignBuiltin { id: string; name: string; category: string; width: number; height: number; fields: { key: string; label: string }[] }
interface WebsiteTheme { id: string; name: string; industry: string | null; cssVars: Record<string, string>; layout?: unknown; preview: string | null; isDefault: boolean; active: boolean }

const CONTENT_TYPES = ['social_post', 'festival_poster', 'blog_post', 'ad_creative', 'email', 'whatsapp', 'sms', 'document'];
const INDUSTRIES = ['', 'travel', 'restaurant', 'clinic', 'hotel', 'salon', 'gym', 'realestate', 'education', 'retail', 'construction', 'events', 'finance', 'automobile', 'logistics', 'diagnostics', 'photography', 'professional', 'agriculture', 'coaching', 'technology'];

const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none';

// Badge per row. 'prompt' → AI Prompt; anything else (synced design templates,
// business documents) shows under the single "AI Template" category.
const AI_TEMPLATE_BADGE = { label: 'AI Template', cls: 'bg-violet-500/15 text-violet-300' };
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  prompt: { label: 'AI Prompt', cls: 'bg-primary-500/15 text-primary-300' },
  canva: AI_TEMPLATE_BADGE,
  document: AI_TEMPLATE_BADGE,
  design: AI_TEMPLATE_BADGE,
  reel: AI_TEMPLATE_BADGE,
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
  const [designBuiltins, setDesignBuiltins] = useState<DesignBuiltin[]>([]);
  const [themes, setThemes] = useState<WebsiteTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingT, setSavingT] = useState(false);
  const [savingTh, setSavingTh] = useState(false);

  const [tpl, setTpl] = useState({ name: '', contentType: CONTENT_TYPES[0], industry: '', prompt: '', thumbnail: '' });
  const [theme, setTheme] = useState({ name: '', industry: '', primary: '#2563eb', accent: '#3b82f6', radius: '16px', preview: '', isDefault: false, code: '' });

  // Admin design-template authoring (Fabric editor). `starter` collects name/category
  // + size; `editor` (once opened) holds the size the blank canvas opens at.
  const [starter, setStarter] = useState<{ name: string; category: string } | null>(null);
  const [editor, setEditor] = useState<{ name: string; category: string; width: number; height: number } | null>(null);
  const [savingDesign, setSavingDesign] = useState(false);

  async function saveDesign(data: { editorJson: Record<string, unknown>; fields: { key: string; label: string }[]; width: number; height: number }) {
    if (!editor) return;
    setSavingDesign(true); setError('');
    try {
      await api.createAiTemplate({
        name: editor.name,
        contentType: editor.category,   // category doubles as the AI-template contentType
        source: 'design',
        prompt: editor.name,            // prompt column is required; not used for design templates
        editorJson: { ...data.editorJson, width: data.width, height: data.height },
        fields: data.fields,
      });
      setEditor(null); setStarter(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save template'); }
    finally { setSavingDesign(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const [t, th, docs, designs] = await Promise.all([api.aiTemplatesAll(), api.websiteThemesAll(), api.businessDocTemplates(), api.designTemplates()]);
      setTemplates(t.data ?? []);
      setThemes(th.data ?? []);
      setDocBuiltins(docs.data ?? []);
      setDesignBuiltins(designs.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addTemplate() {
    if (!tpl.name || !tpl.prompt) return;
    setSavingT(true); setError('');
    try {
      // This form creates AI-prompt templates. Design templates are authored in the
      // Fabric editor (New design template ↓); business documents are coded.
      await api.createAiTemplate({ name: tpl.name, contentType: tpl.contentType, industry: tpl.industry || undefined, prompt: tpl.prompt, thumbnail: tpl.thumbnail || undefined, source: 'prompt' });
      setTpl({ name: '', contentType: CONTENT_TYPES[0], industry: '', prompt: '', thumbnail: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setSavingT(false); }
  }
  async function addTheme() {
    if (!theme.name) return;
    setSavingTh(true); setError('');
    try {
      let layout: Record<string, unknown> | undefined;
      let cssVars: Record<string, string> = { '--primary': theme.primary, '--accent': theme.accent, '--radius': theme.radius };
      const raw = theme.code.trim();
      if (raw) {
        let parsed: unknown;
        try { parsed = JSON.parse(raw); }
        catch { setError('Template code is not valid JSON.'); setSavingTh(false); return; }
        const obj = parsed as { sections?: unknown; theme?: { accent?: string; accent2?: string; radius?: string } } | null;
        if (!obj || typeof obj !== 'object' || !Array.isArray(obj.sections) || obj.sections.length === 0 || !obj.theme || typeof obj.theme !== 'object') {
          setError('Template code must be an object with a non-empty "sections" array and a "theme" object.');
          setSavingTh(false); return;
        }
        layout = obj as Record<string, unknown>;
        // Derive the swatches/radius shown in the picker from the pasted template.
        cssVars = { '--primary': obj.theme.accent ?? theme.primary, '--accent': obj.theme.accent2 ?? theme.accent, '--radius': obj.theme.radius ?? theme.radius };
      }
      await api.createWebsiteTheme({ name: theme.name, industry: theme.industry || undefined, isDefault: theme.isDefault, preview: theme.preview || undefined, cssVars, layout });
      setTheme({ name: '', industry: '', primary: '#2563eb', accent: '#3b82f6', radius: '16px', preview: '', isDefault: false, code: '' });
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

          {/* Author an editable design template in the in-app Fabric editor (no external tool) */}
          {(typeFilter === 'all' || typeFilter === 'template') && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-white"><Palette className="h-4 w-4 text-violet-300" />New design template</div>
              <p className="mb-3 text-xs text-slate-500">Position text/image objects, tag ones as data fields (business_name, offer_text…), save. Vendors pick it, fields prefill, they edit + export.</p>
              {!starter ? (
                <button onClick={() => setStarter({ name: '', category: DESIGN_CATEGORIES[0] })} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"><Plus className="h-4 w-4" />New design template</button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} placeholder="Template name (e.g. Diwali Offer Poster)" value={starter.name} onChange={(e) => setStarter({ ...starter, name: e.target.value })} />
                  <select className={inputCls} value={starter.category} onChange={(e) => setStarter({ ...starter, category: e.target.value })}>{DESIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() => { const s = SIZE_PRESETS[starter.category] ?? { w: 1080, h: 1080 }; setEditor({ name: starter.name, category: starter.category, width: s.w, height: s.h }); }}
                      disabled={!starter.name.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">Open editor →</button>
                    <button onClick={() => setStarter(null)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200">Cancel</button>
                  </div>
                </div>
              )}
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

            {/* Editable design templates — built-in samples, opened in AI Studio's Fabric editor */}
            {showDocs && designBuiltins.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${AI_TEMPLATE_BADGE.cls}`}>{AI_TEMPLATE_BADGE.label}</span>
                    <Palette className="h-3.5 w-3.5 text-slate-500" />{d.name}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500"><Lock className="h-3 w-3" />Editable · Built-in</span>
                  </div>
                  <div className="truncate text-xs text-slate-500">{d.category} · {d.width}×{d.height} · in-app editor · fields: {d.fields.map((f) => f.label).join(', ')}</div>
                </div>
              </div>
            ))}

            {visibleTemplates.length === 0 && !(showDocs && (docBuiltins.length || designBuiltins.length)) && (
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
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-slate-300">Template code (JSON) — optional</div>
              <textarea
                className={`${inputCls} h-40 font-mono text-xs`}
                placeholder='Paste a full template design here, e.g. {"theme":{...},"sections":[{"type":"hero",...}],"nav":[...],"brandDefaults":{...}}. Leave blank for a colours-only theme.'
                value={theme.code}
                onChange={(e) => setTheme({ ...theme, code: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Paste the data-driven template design (the engine WebsiteTemplate shape). When present it renders as a full custom layout live — no redeploy. Leave blank to save a colours-only re-skin using the pickers above.</p>
            </div>
            <p className="mt-2 text-xs text-slate-500">Add several themes per industry — each with its own preview thumbnail — so vendors pick from a set, not one fixed look.</p>
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
                <div className="text-xs text-slate-500">{t.industry ?? 'any industry'} · {t.layout ? 'full design' : 'colours only'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-screen Fabric editor overlay — admin authoring mode */}
      {editor && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <div className="text-sm font-bold text-slate-800">Editing: {editor.name} <span className="font-normal text-slate-400">· {editor.category} · {editor.width}×{editor.height}</span></div>
            {savingDesign && <span className="text-xs text-slate-400">Saving…</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <FabricEditor
              mode="admin"
              width={editor.width}
              height={editor.height}
              scene={null}
              onSave={saveDesign}
              onClose={() => setEditor(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
