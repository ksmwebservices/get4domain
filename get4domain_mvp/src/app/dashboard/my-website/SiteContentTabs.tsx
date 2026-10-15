'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';

/**
 * The tabs added for the industry designs: Page content (headline, questions, steps and the rest), Items, Template (the four designs of your category) and the
 * "Sample content" panel. The list of fields is EDITOR_EXTRAS_FIELDS, the same list the guard checks against what the public page reads.
 */
export interface Extras {
  headline?: string; subline?: string; ctaLabel?: string; announcement?: string; announcementLink?: string;
  trust?: string[]; faq?: { q: string; a: string }[]; steps?: { title: string; desc?: string }[]; stats?: { value: string; label: string }[];
  team?: { name: string; role?: string; note?: string; image?: string }[]; beforeAfter?: { before: string; after: string; caption?: string }[];
  sample?: Record<string, boolean>;
}

/** Every field of `extras` the public page can show, and where it is edited. */
export const EDITOR_EXTRAS_FIELDS = ['headline', 'subline', 'ctaLabel', 'announcement', 'announcementLink', 'trust', 'faq', 'steps', 'stats', 'team', 'beforeAfter'] as const;

const field = 'w-full rounded-xl border border-slate-200 bg-white text-slate-900 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100';
const lbl = 'mb-1.5 block text-xs font-medium text-slate-600';
const SAMPLE_LABEL: Record<string, string> = {
  tagline: 'Tagline', about: 'About text', banner: 'Top picture', gallery: 'Gallery pictures', headline: 'Headline', subline: 'Sub-line', ctaLabel: 'Button label', announcement: 'Announcement bar',
  announcementLink: 'Announcement link', trust: 'Trust points', faq: 'Questions and answers', steps: 'How it works steps', stats: 'Numbers', team: 'Team', beforeAfter: 'Before and after',
};
const SAMPLE_TAB: Record<string, string> = { tagline: 'basic', about: 'about', banner: 'branding', gallery: 'portfolio', headline: 'content', subline: 'content', ctaLabel: 'content', announcement: 'content', announcementLink: 'content', trust: 'content', faq: 'content', steps: 'content', stats: 'content', team: 'content', beforeAfter: 'content' };

export interface SampleSummary { fields: string[]; items: number; quotes: number }

/** Lists every part of the site that is still starter text, with a button to the place where it is edited. */
export function SamplePanel({ sample, onGo, onReset, busy }: { sample: SampleSummary; onGo: (tab: string) => void; onReset: () => void; busy: boolean }) {
  const total = sample.fields.length + (sample.items ? 1 : 0) + (sample.quotes ? 1 : 0);
  if (!total) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Sparkles className="h-4 w-4" />Sample content</h2>
          <p className="mt-1 text-sm text-amber-900/80">These parts of your site are starter text we wrote for your kind of business. Sample text may show on your page, but sample prices and sample customer quotes are never shown to the public. Change each one to make it yours.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onReset} loading={busy} title="Fills only what is empty or still sample. Nothing you wrote is touched.">Reset to starter</Button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {sample.fields.map((k) => <li key={k}><button type="button" onClick={() => onGo(SAMPLE_TAB[k] ?? 'content')} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">{SAMPLE_LABEL[k] ?? k}: edit</button></li>)}
        {sample.items > 0 && <li><button type="button" onClick={() => onGo('items')} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">{sample.items} sample item{sample.items === 1 ? '' : 's'}: edit</button></li>}
        {sample.quotes > 0 && <li><button type="button" onClick={() => onGo('testimonials')} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">{sample.quotes} sample customer quote{sample.quotes === 1 ? '' : 's'}: replace</button></li>}
      </ul>
    </div>
  );
}

const Box = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{hint && <p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p>}<div className={hint ? '' : 'mt-3'}>{children}</div></div>
);

/** Page content: everything a design shows that is not a plain field. Every list shows only when it has entries. */
export function PageContentTab({ extras, set }: { extras: Extras; set: (next: Extras) => void }) {
  const upd = (patch: Partial<Extras>): void => set({ ...extras, ...patch });
  const txt = (k: 'headline' | 'subline' | 'ctaLabel' | 'announcement' | 'announcementLink', label: string, hint?: string, max = 200) => (
    <div><label className={lbl}>{label}{hint && <span className="text-slate-400"> — {hint}</span>}</label><input className={field} maxLength={max} value={extras[k] ?? ''} onChange={(e) => upd({ [k]: e.target.value })} /></div>
  );
  const trust = extras.trust ?? []; const faq = extras.faq ?? []; const steps = extras.steps ?? []; const stats = extras.stats ?? []; const team = extras.team ?? []; const ba = extras.beforeAfter ?? [];
  return (
    <div className="space-y-4">
      <Box title="Top of the page" hint="The big words visitors read first.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{txt('headline', 'Headline', 'the large line at the top', 160)}</div>
          <div className="sm:col-span-2">{txt('subline', 'Sub-line', 'one sentence under it', 300)}</div>
          {txt('ctaLabel', 'Main button label', 'for example Book my slot', 40)}
        </div>
      </Box>
      <Box title="Announcement bar" hint="A short line above the page, for an offer or a notice. Leave empty to hide it.">
        <div className="grid gap-3 sm:grid-cols-2">{txt('announcement', 'Announcement', undefined, 200)}{txt('announcementLink', 'Link', 'optional, starts with https://, tel: or #', 200)}</div>
      </Box>
      <Box title="Trust points" hint="Up to 8 short promises, shown as a strip.">
        {trust.map((t, i) => <div key={i} className="mb-2 flex gap-2"><input className={field} maxLength={100} value={t} onChange={(e) => upd({ trust: trust.map((x, j) => (j === i ? e.target.value : x)) })} /><button type="button" aria-label="Remove" className="text-slate-400 hover:text-error-600" onClick={() => upd({ trust: trust.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button></div>)}
        {trust.length < 8 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ trust: [...trust, ''] })}>Add a point</Button>}
      </Box>
      <Box title="Common questions" hint="Up to 12 questions and answers.">
        {faq.map((f, i) => (
          <div key={i} className="mb-3 space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex gap-2"><input className={field} placeholder="Question" maxLength={200} value={f.q} onChange={(e) => upd({ faq: faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} /><button type="button" aria-label="Remove question" className="text-slate-400 hover:text-error-600" onClick={() => upd({ faq: faq.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button></div>
            <textarea rows={2} className={field} placeholder="Answer" maxLength={800} value={f.a} onChange={(e) => upd({ faq: faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
          </div>
        ))}
        {faq.length < 12 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ faq: [...faq, { q: '', a: '' }] })}>Add a question</Button>}
      </Box>
      <Box title="How it works" hint="Up to 8 steps.">
        {steps.map((s, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
            <input className={field} placeholder="Step" maxLength={80} value={s.title} onChange={(e) => upd({ steps: steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
            <input className={field} placeholder="A few words about it" maxLength={160} value={s.desc ?? ''} onChange={(e) => upd({ steps: steps.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) })} />
            <button type="button" aria-label="Remove step" className="text-slate-400 hover:text-error-600" onClick={() => upd({ steps: steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {steps.length < 8 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ steps: [...steps, { title: '', desc: '' }] })}>Add a step</Button>}
      </Box>
      <Box title="Numbers" hint="Only real, checkable numbers, for example 12 years in business. Shown only when you add them.">
        {stats.map((s, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <input className={field} placeholder="12 years" maxLength={20} value={s.value} onChange={(e) => upd({ stats: stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
            <input className={field} placeholder="in business" maxLength={40} value={s.label} onChange={(e) => upd({ stats: stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <button type="button" aria-label="Remove number" className="text-slate-400 hover:text-error-600" onClick={() => upd({ stats: stats.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {stats.length < 6 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ stats: [...stats, { value: '', label: '' }] })}>Add a number</Button>}
      </Box>
      <Box title="Team" hint="The people customers will meet. Shown only when you add them.">
        {team.map((m, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input className={field} placeholder="Name" maxLength={80} value={m.name} onChange={(e) => upd({ team: team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input className={field} placeholder="Role" maxLength={80} value={m.role ?? ''} onChange={(e) => upd({ team: team.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} />
            <input className={field} placeholder="Picture address (optional)" maxLength={500} value={m.image ?? ''} onChange={(e) => upd({ team: team.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)) })} />
            <button type="button" aria-label="Remove person" className="text-slate-400 hover:text-error-600" onClick={() => upd({ team: team.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {team.length < 12 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ team: [...team, { name: '', role: '' }] })}>Add a person</Button>}
      </Box>
      <Box title="Before and after" hint="Pairs of pictures, shown only when you add them. Paste the picture addresses from your gallery.">
        {ba.map((b, i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input className={field} placeholder="Before picture address" maxLength={600} value={b.before} onChange={(e) => upd({ beforeAfter: ba.map((x, j) => (j === i ? { ...x, before: e.target.value } : x)) })} />
            <input className={field} placeholder="After picture address" maxLength={600} value={b.after} onChange={(e) => upd({ beforeAfter: ba.map((x, j) => (j === i ? { ...x, after: e.target.value } : x)) })} />
            <input className={field} placeholder="Caption (optional)" maxLength={120} value={b.caption ?? ''} onChange={(e) => upd({ beforeAfter: ba.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
            <button type="button" aria-label="Remove pair" className="text-slate-400 hover:text-error-600" onClick={() => upd({ beforeAfter: ba.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {ba.length < 8 && <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => upd({ beforeAfter: [...ba, { before: '', after: '' }] })}>Add a pair</Button>}
      </Box>
    </div>
  );
}

/* ── Items: the vendor's own catalogue, as the design shows it ── */
interface Item { id: string; name: string; description: string | null; price: string | null; image: string | null; category: string | null; customFields: Record<string, string> | null; active: boolean }

export function ItemsTab({ vendorId, itemFields, noun, onChanged }: { vendorId: string; itemFields: { key: string; label: string }[]; noun: string; onChanged: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => { api.getVendorProductsManage(vendorId).then((r) => setItems(((r.data ?? r) as Item[]) ?? [])).catch((e: Error) => setError(e.message)); }, [vendorId]);
  useEffect(() => { load(); }, [load]);
  const patchLocal = (id: string, p: Partial<Item>): void => setItems((l) => (l ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)));
  const save = async (it: Item): Promise<void> => {
    setBusy(it.id); setError('');
    try { await api.updateProduct(it.id, { name: it.name, description: it.description ?? '', price: it.price ?? '', category: it.category ?? '', customFields: it.customFields ?? {} }); load(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const remove = async (it: Item): Promise<void> => {
    if (!window.confirm(`Hide "${it.name}" from your site?`)) return;
    setBusy(it.id);
    try { await api.updateProduct(it.id, { active: false }); load(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const add = async (): Promise<void> => {
    setBusy('new'); setError('');
    try { await api.addProduct(vendorId, { name: `New ${noun}`, description: '', price: '' }); load(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const upload = async (it: Item, file: File): Promise<void> => {
    setBusy(it.id); setError('');
    try { const r = await api.uploadImage(file, 'PRODUCT'); if (!r.data?.url) throw new Error('The picture could not be uploaded. Please try again.'); await api.updateProduct(it.id, { image: r.data.url }); load(); onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  if (items === null) return <p className="text-sm text-slate-500">{error || 'Loading your items...'}</p>;
  const visible = items.filter((i) => i.active !== false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">These are the {noun}s your site lists. An item marked <span className="font-semibold text-amber-700">Sample</span> was written for you: its text may show, but its price is hidden (visitors see &ldquo;Contact for price&rdquo;) until you set your own price. Items save on their own; they do not wait for Publish.</p>
      {error && <div role="alert" className="rounded-xl border border-error-200 bg-error-50 px-4 py-2 text-sm text-error-700">{error}</div>}
      {visible.map((it) => {
        const cf = it.customFields ?? {};
        const sample = cf.sample === 'true'; const samplePrice = cf.samplePrice === 'true';
        return (
          <div key={it.id} className="rounded-xl border border-slate-200 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
              <input className={field} aria-label="Name" value={it.name} maxLength={120} onChange={(e) => patchLocal(it.id, { name: e.target.value })} />
              <input className={field} aria-label="Price" placeholder={samplePrice ? 'Set your price' : 'Price'} value={samplePrice ? '' : it.price ?? ''} onChange={(e) => patchLocal(it.id, { price: e.target.value, customFields: { ...cf, samplePrice: '' } })} />
              <input className={field} aria-label="Category" placeholder="Category" value={it.category ?? ''} onChange={(e) => patchLocal(it.id, { category: e.target.value })} />
            </div>
            <textarea rows={2} className={`${field} mt-2`} aria-label="Description" value={it.description ?? ''} maxLength={600} onChange={(e) => patchLocal(it.id, { description: e.target.value })} />
            {itemFields.length > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {itemFields.map((f) => <input key={f.key} className={field} aria-label={f.label} placeholder={f.label} value={cf[f.key] ?? ''} maxLength={120} onChange={(e) => patchLocal(it.id, { customFields: { ...cf, [f.key]: e.target.value } })} />)}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {it.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image} alt="" className="h-10 w-14 rounded object-cover" /> : null}
              <label className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50">Picture<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(it, f); }} /></label>
              {sample && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Sample</span>}
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void save(it)} loading={busy === it.id}>Save item</Button>
                <button type="button" aria-label={`Hide ${it.name}`} className="text-slate-400 hover:text-error-600" onClick={() => void remove(it)}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          </div>
        );
      })}
      <Button size="sm" variant="outline" leftIcon={busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} onClick={() => void add()}>Add a {noun}</Button>
    </div>
  );
}

/* ── Template: the four designs of the vendor's own category, shown with the vendor's own content ── */
export interface DesignOption { key: string; name: string; themeKey: string; font: string; radius: string; button: string; sections: string[] }
export interface DesignsView { packKey: string | null; family: string | null; current: string | null; defaultDesign: string | null; designs: DesignOption[]; itemFields?: { key: string; label: string }[] }

export function TemplateTab({ view, previewBase, onPick, busy, onRefresh }: { view: DesignsView | null; previewBase: string; onPick: (key: string) => void; busy: boolean; onRefresh: () => void }) {
  if (!view) return <p className="text-sm text-slate-500">Loading designs...</p>;
  if (!view.designs.length) return <p className="text-sm text-slate-500">Designs are not set up for your category yet. Choose a category first, or contact support.</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">These are the four designs made for your kind of business. Each one is built for how your customers use your site. Switching never changes your words, items or pictures; the change is saved as a draft until you press Publish.</p>
        <Button size="sm" variant="outline" onClick={onRefresh}>Refresh previews</Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {view.designs.map((d) => {
          const on = d.key === view.current;
          const src = previewBase ? `${previewBase}${previewBase.includes('?') ? '&' : '?'}design=${encodeURIComponent(d.key)}` : '';
          return (
            <div key={d.key} className={`overflow-hidden rounded-2xl border ${on ? 'border-primary-500 ring-2 ring-primary-100' : 'border-slate-200'}`}>
              <div className="relative h-56 overflow-hidden bg-slate-100" aria-hidden={!src}>
                {src ? <iframe title={`${d.name} design with your content`} src={src} loading="lazy" tabIndex={-1} className="pointer-events-none absolute left-0 top-0 h-[900px] w-[1280px] origin-top-left border-0" style={{ transform: 'scale(0.36)' }} /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Preview loading...</div>}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <div><div className="text-sm font-semibold text-slate-900">{d.name}{on && <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">In use</span>}</div><div className="text-xs text-slate-500">{d.sections.slice(0, 5).map((s) => s.split(':')[0]).join(' · ')}</div></div>
                {!on && <Button size="sm" onClick={() => onPick(d.key)} loading={busy}>Use this design</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
