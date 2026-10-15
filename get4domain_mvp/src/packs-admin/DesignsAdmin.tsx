'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SITE_THEME_LIST } from '@/engine/sitedoc/build';
import vocab from '@/engine/sitedoc/design-vocab.json';

/** Industry designs in the Category packs screen: the flow family, the four designs, the starter content, and one-site creation. No code per category. */
export interface DesignSpec { key: string; name: string; enabled: boolean; themeKey: string; font: string; radius: string; button: string; nav: string; footer: string; actionBar: string; sections: { type: string; variant: string }[] }
export interface StarterSeed {
  headline: string; subline: string; tagline: string; about: string; announce: string; cta: string;
  trust: string[]; steps: { title: string; desc: string }[]; quotes: { quote: string; author: string }[];
  items: { title: string; desc: string; price: string; category: string; fields: Record<string, string> }[];
  faq: { q: string; a: string }[]; motif: string; hue: number; images: { hero: string; gallery: string[] };
}
export interface DesignFields { family?: string; designs?: DesignSpec[]; defaultDesign?: string; seed?: StarterSeed }

export const FAMILY_LABEL: Record<string, string> = { shop: 'Shop and cart', booking: 'Booking and appointment', enquiry: 'Enquiry and services', packages: 'Packages and tours', menu: 'Menu and orders', portfolio: 'Portfolio and gallery', listings: 'Listings', courses: 'Courses and classes' };
export const BLANK_SEED: StarterSeed = {
  headline: '{business}', subline: 'Tell us what you need and we will get back to you.', tagline: '{business} in {city}', about: '{business} is a business in {city}. Tell us what you need and we will reply.', announce: 'Send us a message. We reply as soon as we can.', cta: 'Get in touch',
  trust: ['Free first conversation', 'Estimate in writing', 'Clear communication', 'Easy to reach'], steps: [{ title: 'Tell us what you need', desc: 'A short message is enough.' }, { title: 'We reply', desc: 'With a next step.' }, { title: 'Agree', desc: 'Price in writing.' }, { title: 'We deliver', desc: 'And stay in touch.' }],
  quotes: [{ quote: 'Prompt and polite.', author: 'Sample customer' }], items: [{ title: 'Our main service', desc: 'Describe it in a sentence.', price: '', category: 'Services', fields: {} }, { title: 'Another service', desc: 'Describe it in a sentence.', price: '', category: 'Services', fields: {} }, { title: 'Custom requests', desc: 'Tell us what you have in mind.', price: '', category: 'Services', fields: {} }],
  faq: [{ q: 'How do I get in touch?', a: 'Use the form on this page.' }, { q: 'Where are you?', a: 'We serve {city} and nearby areas.' }, { q: 'How do I know the price?', a: 'Send us your request and we will reply with a price.' }],
  motif: 'Store', hue: 175, images: { hero: '/starter/general/hero.webp', gallery: [1, 2, 3, 4].map((n) => `/starter/general/g${n}.webp`) },
};

const inp = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-400 focus:outline-none';
const lab = 'mb-1 block text-xs font-medium text-slate-400';
const lines = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean);

export function DesignsFields({ c, setC }: { c: DesignFields; setC: (p: DesignFields) => void }) {
  const seed = c.seed ?? BLANK_SEED;
  const setSeed = (p: Partial<StarterSeed>): void => setC({ seed: { ...seed, ...p } });
  const designs = c.designs ?? [];
  const setDesign = (i: number, p: Partial<DesignSpec>): void => setC({ designs: designs.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  const enabledCount = designs.filter((d) => d.enabled !== false).length;
  return (
    <div className="space-y-4 md:col-span-2">
      <h3 className="text-sm font-semibold text-white">Industry designs</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={lab}>Flow family (decides the layouts and what visitors do)</label>
          <select className={inp} value={c.family ?? 'enquiry'} onChange={(e) => setC({ family: e.target.value, designs: undefined, defaultDesign: undefined })}>
            {vocab.families.map((f) => <option key={f} value={f}>{FAMILY_LABEL[f] ?? f}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">Changing the family rebuilds the four designs when you save.</p>
        </div>
        <div>
          <label className={lab}>Design new vendors start with</label>
          <select className={inp} value={c.defaultDesign ?? ''} onChange={(e) => setC({ defaultDesign: e.target.value })} disabled={!designs.length}>
            {designs.filter((d) => d.enabled !== false).map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
        </div>
      </div>
      {designs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <table className="w-full text-left text-sm"><thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">On</th><th className="px-3 py-2">Design</th><th className="px-3 py-2">Theme</th><th className="px-3 py-2">Sections</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {designs.map((d, i) => (
                <tr key={d.key} className="text-slate-200">
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`${d.name} switched on`} checked={d.enabled !== false} onChange={(e) => setDesign(i, { enabled: e.target.checked })} /></td>
                  <td className="px-3 py-2"><input className={inp} value={d.name} maxLength={30} onChange={(e) => setDesign(i, { name: e.target.value })} /></td>
                  <td className="px-3 py-2"><select className={inp} value={d.themeKey} onChange={(e) => setDesign(i, { themeKey: e.target.value })}>{SITE_THEME_LIST.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></td>
                  <td className="px-3 py-2 text-xs text-slate-400">{d.sections.map((s) => `${s.type}:${s.variant}`).join('  ')}</td>
                </tr>
              ))}
            </tbody></table>
        </div>
      ) : <p className="text-xs text-slate-500">The four designs of the chosen family are created when you save.</p>}
      {designs.length > 0 && enabledCount !== 4 && <p className="text-xs text-amber-300">Exactly 4 designs must be switched on (now {enabledCount}).</p>}

      <h3 className="pt-2 text-sm font-semibold text-white">Starter content (copied into every new site, marked sample)</h3>
      <p className="text-xs text-slate-500">Use {'{business}'}, {'{city}'} and {'{phone}'}. Never write numbers, awards or names of people that may not be true of the vendor.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className={lab}>Headline</label><input className={inp} value={seed.headline} onChange={(e) => setSeed({ headline: e.target.value })} /></div>
        <div><label className={lab}>Tagline</label><input className={inp} value={seed.tagline} onChange={(e) => setSeed({ tagline: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={lab}>Sub-line</label><input className={inp} value={seed.subline} onChange={(e) => setSeed({ subline: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={lab}>About text</label><textarea rows={3} className={inp} value={seed.about} onChange={(e) => setSeed({ about: e.target.value })} /></div>
        <div><label className={lab}>Announcement bar</label><input className={inp} value={seed.announce} onChange={(e) => setSeed({ announce: e.target.value })} /></div>
        <div><label className={lab}>Main button label</label><input className={inp} value={seed.cta} onChange={(e) => setSeed({ cta: e.target.value })} /></div>
        <div className="md:col-span-2"><label className={lab}>Items, 3 to 12 (one per line: name | description | sample price | category)</label>
          <textarea rows={7} className={inp} value={seed.items.map((i) => `${i.title} | ${i.desc} | ${i.price} | ${i.category}`).join('\n')} onChange={(e) => setSeed({ items: lines(e.target.value).map((l) => { const [title = '', desc = '', price = '', category = ''] = l.split('|').map((x) => x.trim()); const old = seed.items.find((o) => o.title === title); return { title, desc, price, category, fields: old?.fields ?? {} }; }) })} /></div>
        <div><label className={lab}>Trust points (one per line)</label><textarea rows={4} className={inp} value={seed.trust.join('\n')} onChange={(e) => setSeed({ trust: lines(e.target.value) })} /></div>
        <div><label className={lab}>How it works (one per line: step | a few words)</label><textarea rows={4} className={inp} value={seed.steps.map((s) => `${s.title} | ${s.desc}`).join('\n')} onChange={(e) => setSeed({ steps: lines(e.target.value).map((l) => { const [title = '', desc = ''] = l.split('|').map((x) => x.trim()); return { title, desc }; }) })} /></div>
        <div><label className={lab}>Questions, at least 3 (one per line: question | answer)</label><textarea rows={5} className={inp} value={seed.faq.map((f) => `${f.q} | ${f.a}`).join('\n')} onChange={(e) => setSeed({ faq: lines(e.target.value).map((l) => { const [q = '', ...a] = l.split('|'); return { q: q.trim(), a: a.join('|').trim() }; }) })} /></div>
        <div><label className={lab}>Sample customer quotes (one per line: quote | name). Never shown to the public.</label><textarea rows={5} className={inp} value={seed.quotes.map((q) => `${q.quote} | ${q.author}`).join('\n')} onChange={(e) => setSeed({ quotes: lines(e.target.value).map((l) => { const [quote = '', ...a] = l.split('|'); return { quote: quote.trim(), author: a.join('|').trim() || 'Sample customer' }; }) })} /></div>
      </div>
    </div>
  );
}

/** One new site for a category and business details. It starts as DRAFT: hidden from the public until it is published or claimed. */
export function CreateSiteCard({ categories }: { categories: { key: string; name: string }[] }) {
  const [f, setF] = useState({ categoryKey: '', businessName: '', subdomain: '', city: '', phone: '' });
  const [res, setRes] = useState<{ subdomain: string; status: string; itemsCreated: number; previewUrl: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!f.categoryKey && categories[0]) setF((x) => ({ ...x, categoryKey: categories[0].key })); }, [categories, f.categoryKey]);
  const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const go = async (): Promise<void> => {
    setBusy(true); setErr(''); setRes(null);
    try { const r = await api.adminPackCreateSite({ categoryKey: f.categoryKey, businessName: f.businessName.trim(), subdomain: f.subdomain.trim(), city: f.city.trim() || undefined, phone: f.phone.trim() || undefined }); setRes(r.data as typeof res); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Create one site</h2>
      <p className="mt-1 text-sm text-slate-400">Choose a category and enter the business details. The site is made with the category&apos;s starter content and its default design, and stays hidden (DRAFT) until it is published or claimed.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div><label className={lab}>Category</label><select className={inp} value={f.categoryKey} onChange={(e) => setF({ ...f, categoryKey: e.target.value })}>{categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>
        <div><label className={lab}>Business name</label><input className={inp} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value, subdomain: f.subdomain || slug(e.target.value) })} /></div>
        <div><label className={lab}>Site address (before .get4domain.com)</label><input className={inp} value={f.subdomain} onChange={(e) => setF({ ...f, subdomain: slug(e.target.value) })} /></div>
        <div><label className={lab}>City</label><input className={inp} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div><label className={lab}>Phone</label><input className={inp} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="flex items-end"><button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !f.categoryKey || !f.businessName.trim() || f.subdomain.length < 3} onClick={() => void go()}>{busy ? 'Creating...' : 'Create site'}</button></div>
      </div>
      {err && <div role="alert" className="mt-3 rounded-lg border border-red-700 bg-red-950/60 px-4 py-2 text-sm text-red-200">{err}</div>}
      {res && <div className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-200">Created {res.subdomain} as {res.status} with {res.itemsCreated} starter items. <a className="underline" href={res.previewUrl} target="_blank" rel="noopener noreferrer">Open the private preview</a> (not public).</div>}
    </div>
  );
}
