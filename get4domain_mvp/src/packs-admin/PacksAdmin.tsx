'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { SITE_THEME_LIST, VARIANTS } from '@/engine/sitedoc/build';
import { BLANK_SEED, CreateSiteCard, DesignsFields, FAMILY_LABEL, type DesignFields } from './DesignsAdmin';

interface Pack { key: string; name: string; enabled: boolean; config: PackConfig }
interface PackConfig {
  keywords: string[]; goal: string; ctaLabel: string; sections: string[];
  item: { kind: string; noun: string; nounPlural: string };
  defaults: { tagline: string; about: string; headline: string; subline: string; trust: string[]; faq: { q: string; a: string }[] };
  themeKey: string; layouts: Record<string, string>; seoType: string; aiPrompts: { about: string; tagline: string; images: string };
  family?: string; designs?: DesignFields['designs']; defaultDesign?: string; seed?: DesignFields['seed'];
}
const GOALS = ['ENQUIRY', 'BOOKING', 'APPOINTMENT', 'SITE_VISIT', 'CART_ORDER'];
const SECTIONS = ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'];
const KINDS = ['product', 'package', 'service', 'room', 'treatment', 'case', 'listing'];
const SEO = ['LocalBusiness', 'Store', 'MedicalClinic', 'BeautySalon', 'TravelAgency', 'Restaurant', 'RealEstateAgent', 'LegalService', 'EducationalOrganization', 'ProfessionalService', 'HealthAndBeautyBusiness', 'AutoRepair', 'LodgingBusiness', 'SportsActivityLocation', 'GeneralContractor'];

const BLANK: PackConfig = {
  keywords: [], goal: 'ENQUIRY', ctaLabel: 'Get in touch', sections: ['hero', 'services', 'about', 'gallery', 'testimonials', 'faq', 'contact'],
  item: { kind: 'service', noun: 'service', nounPlural: 'services' },
  defaults: { tagline: '{business} in {city}', about: '{business} is a business in {city}. Tell us what you need and we will get back to you.', headline: '{business}', subline: 'Send your details and we will reply.', trust: [], faq: [] },
  themeKey: 'clean-teal', layouts: { hero: 'overlay', about: 'split', services: 'cards', gallery: 'mosaic', testimonials: 'cards', contact: 'card' }, seoType: 'LocalBusiness',
  aiPrompts: { about: 'Write a warm 80-word About text for {business} in {city}.', tagline: 'A short tagline for {business}.', images: 'Three photo ideas for the website of this kind of business.' },
  family: 'enquiry', seed: BLANK_SEED,
};

const inp = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-400 focus:outline-none';
const lab = 'mb-1 block text-xs font-medium text-slate-400';

/** Category packs: how a website is generated for one kind of business. Create, copy, edit, switch on or off, preview. No deploy. MARKETING staff can look and preview only. */
export default function PacksAdmin() {
  const { user } = useAuth();
  const canEdit = (user?.adminRole ?? 'SUPER_ADMIN') !== 'MARKETING';
  const [packs, setPacks] = useState<Pack[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<{ isNew: boolean; key: string; name: string; config: PackConfig } | null>(null);
  const [sample, setSample] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => { api.adminPacks().then((r) => setPacks((r.data ?? []) as Pack[])).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string): Promise<void> => { setErr(''); setMsg(''); try { await fn(); setMsg(ok); load(); } catch (e) { setErr((e as Error).message); } };

  const open = (p: Pack): void => setEdit({ isNew: false, key: p.key, name: p.name, config: JSON.parse(JSON.stringify(p.config)) });
  const c = edit?.config;
  const setC = (patch: Partial<PackConfig>): void => setEdit((e) => (e ? { ...e, config: { ...e.config, ...patch } } : e));
  const lines = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Category packs</h1>
          <p className="text-sm text-slate-400">Each pack describes how a website is generated for one kind of business: sections, wording, theme and layouts. Adding a category is adding a pack. No deploy.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => void run(() => api.adminPackSeed(), 'Starter packs added (existing packs are never changed).')}>Add starter packs</button>
            <button className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setEdit({ isNew: true, key: '', name: '', config: JSON.parse(JSON.stringify(BLANK)) })}>New pack</button>
          </div>
        )}
      </div>
      {err && <div role="alert" className="rounded-lg border border-red-700 bg-red-950/60 px-4 py-2 text-sm text-red-200">{err}</div>}
      {msg && <div className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-200">{msg}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Pack</th><th className="px-3 py-2">Flow family</th><th className="px-3 py-2">Designs</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {packs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No packs yet. {canEdit ? 'Add the starter packs, or create one.' : ''}</td></tr>}
            {packs.map((p) => (
              <tr key={p.key} className="text-slate-200">
                <td className="px-3 py-2"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.key}</div></td>
                <td className="px-3 py-2">{FAMILY_LABEL[p.config.family ?? ''] ?? <span className="text-amber-300">none yet</span>}</td><td className="px-3 py-2 text-xs">{p.config.designs ? p.config.designs.filter((d) => d.enabled !== false).map((d) => d.name).join(', ') : <span className="text-amber-300">Use Add starter packs</span>}</td>
                <td className="px-3 py-2">{p.enabled ? <span className="text-emerald-300">On</span> : <span className="text-slate-500">Off</span>}</td>
                <td className="space-x-3 px-3 py-2 text-right">
                  <button className="text-primary-300 underline" onClick={() => void api.adminPackPreview(p.key).then((r) => setSample(r.data as Record<string, unknown>)).catch((e: Error) => setErr(e.message))}>Preview</button>
                  {canEdit && <>
                    <button className="text-primary-300 underline" onClick={() => open(p)}>Edit</button>
                    <button className="text-primary-300 underline" onClick={() => { const k = window.prompt('Key for the copy (lower-case letters, numbers, dashes)', `${p.key}-copy`); if (k) void run(() => api.adminPackDuplicate(p.key, { key: k, name: `${p.name} (copy)` }), 'Copied.'); }}>Copy</button>
                    <button className="text-primary-300 underline" onClick={() => void run(() => api.adminPackUpdate(p.key, { enabled: !p.enabled }), p.enabled ? 'Switched off: vendors no longer see it.' : 'Switched on.')}>{p.enabled ? 'Switch off' : 'Switch on'}</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && <CreateSiteCard categories={packs.filter((p) => p.enabled && p.config.seed).map((p) => ({ key: p.key, name: p.name }))} />}

      {sample && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-white">Preview with sample details (nothing is saved)</h2><button className="text-slate-400 underline" onClick={() => setSample(null)}>Close</button></div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{JSON.stringify((sample as { sample: unknown }).sample, null, 2)}</pre>
        </div>
      )}

      {edit && c && canEdit && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-white">{edit.isNew ? 'New pack' : `Edit ${edit.name}`}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><label className={lab}>Key (letters, numbers, dashes)</label><input className={inp} value={edit.key} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, key: e.target.value })} placeholder="salon" /></div>
            <div><label className={lab}>Name</label><input className={inp} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Salon" /></div>
            <div><label className={lab}>Keywords that match vendors (one per line)</label><textarea rows={3} className={inp} value={c.keywords.join('\n')} onChange={(e) => setC({ keywords: lines(e.target.value) })} /></div>
            <div className="space-y-3">
              <div><label className={lab}>What visitors do</label><select className={inp} value={c.goal} onChange={(e) => setC({ goal: e.target.value })}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></div>
              <div><label className={lab}>Main button</label><input className={inp} value={c.ctaLabel} onChange={(e) => setC({ ctaLabel: e.target.value })} /></div>
            </div>
            <div><label className={lab}>Sections, in order (one per line: {SECTIONS.join(', ')})</label><textarea rows={7} className={inp} value={c.sections.join('\n')} onChange={(e) => setC({ sections: lines(e.target.value) })} /></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lab}>Item kind</label><select className={inp} value={c.item.kind} onChange={(e) => setC({ item: { ...c.item, kind: e.target.value } })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
                <div><label className={lab}>Singular</label><input className={inp} value={c.item.noun} onChange={(e) => setC({ item: { ...c.item, noun: e.target.value } })} /></div>
                <div><label className={lab}>Plural</label><input className={inp} value={c.item.nounPlural} onChange={(e) => setC({ item: { ...c.item, nounPlural: e.target.value } })} /></div>
              </div>
              <div><label className={lab}>Search-engine type</label><select className={inp} value={c.seoType} onChange={(e) => setC({ seoType: e.target.value })}>{SEO.map((k) => <option key={k}>{k}</option>)}</select></div>
              <div><label className={lab}>Theme</label><select className={inp} value={c.themeKey} onChange={(e) => setC({ themeKey: e.target.value })}>{SITE_THEME_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-3">
              {Object.entries(VARIANTS).map(([slot, opts]) => <div key={slot}><label className={lab}>{slot} layout</label><select className={inp} value={c.layouts[slot]} onChange={(e) => setC({ layouts: { ...c.layouts, [slot]: e.target.value } })}>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>)}
            </div>
            <div className="md:col-span-2 text-xs text-slate-500">Default wording. Use {'{business}'}, {'{city}'} and {'{phone}'}; they are filled from the vendor's details.</div>
            <div><label className={lab}>Tagline</label><input className={inp} value={c.defaults.tagline} onChange={(e) => setC({ defaults: { ...c.defaults, tagline: e.target.value } })} /></div>
            <div><label className={lab}>Headline</label><input className={inp} value={c.defaults.headline} onChange={(e) => setC({ defaults: { ...c.defaults, headline: e.target.value } })} /></div>
            <div className="md:col-span-2"><label className={lab}>About text</label><textarea rows={3} className={inp} value={c.defaults.about} onChange={(e) => setC({ defaults: { ...c.defaults, about: e.target.value } })} /></div>
            <div className="md:col-span-2"><label className={lab}>Sub-line under the headline</label><input className={inp} value={c.defaults.subline} onChange={(e) => setC({ defaults: { ...c.defaults, subline: e.target.value } })} /></div>
            <div><label className={lab}>Trust points (one per line, up to 8)</label><textarea rows={4} className={inp} value={c.defaults.trust.join('\n')} onChange={(e) => setC({ defaults: { ...c.defaults, trust: lines(e.target.value) } })} /></div>
            <div><label className={lab}>Questions (one per line as: question | answer)</label><textarea rows={4} className={inp} value={c.defaults.faq.map((f) => `${f.q} | ${f.a}`).join('\n')} onChange={(e) => setC({ defaults: { ...c.defaults, faq: lines(e.target.value).map((l) => { const [q, ...a] = l.split('|'); return { q: q.trim(), a: a.join('|').trim() }; }).filter((f) => f.q && f.a) } })} /></div>
            <DesignsFields c={c} setC={(p) => setC(p)} />
            <div><label className={lab}>AI Studio: About text prompt</label><textarea rows={2} className={inp} value={c.aiPrompts.about} onChange={(e) => setC({ aiPrompts: { ...c.aiPrompts, about: e.target.value } })} /></div>
            <div><label className={lab}>AI Studio: tagline prompt</label><textarea rows={2} className={inp} value={c.aiPrompts.tagline} onChange={(e) => setC({ aiPrompts: { ...c.aiPrompts, tagline: e.target.value } })} /></div>
            <div className="md:col-span-2"><label className={lab}>AI Studio: picture ideas prompt</label><textarea rows={2} className={inp} value={c.aiPrompts.images} onChange={(e) => setC({ aiPrompts: { ...c.aiPrompts, images: e.target.value } })} /></div>
          </div>
          <div className="mt-5 flex gap-3">
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void run(async () => { if (edit.isNew) await api.adminPackCreate({ key: edit.key.trim(), name: edit.name.trim(), config: edit.config }); else await api.adminPackUpdate(edit.key, { name: edit.name.trim(), config: edit.config }); setEdit(null); }, 'Saved.')}>Save pack</button>
            <button className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
