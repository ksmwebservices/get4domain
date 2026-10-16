'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

/**
 * Admin, Theme marketplace. Upload a theme zip (checked with the same rules as the lint command, with plain reasons when refused), look at it on desktop and on a phone for
 * every category it is for (the popup and the bottom bar included), set its categories, its role (a free default design that replaces one of the four built-in ones, or a
 * marketplace theme with a yearly price), its price and status, copy or retire it, and read the sales report. MARKETING staff can look and preview only. No deploy to add a theme.
 */
interface ThemeRow { id: string; key: string; version: number; name: string; role: string; status: string; replacesDesign: string | null; priceYearlyPaise: number | null; categories: string[]; families: string[]; activeLicences: number; createdAt: string; lintSummary: { warnings: number; contrastFails: number } }
interface LintLine { level: string; text: string }
interface Detail extends ThemeRow { lint?: { lines?: LintLine[]; contrast?: { what: string; ratio: number | null; ok: boolean }[] }; pageNames?: string[]; manifest?: { description?: string; author?: string } }
interface Pack { key: string; name: string; enabled: boolean; config: { family?: string } }
interface Report { totals: { sold: number; active: number; revenuePaise: number; gstPaise: number }; perTheme: { key: string; name: string; sold: number; active: number; revenuePaise: number; gstPaise: number }[]; expiringSoon: { vendorId: string; businessName: string; themeName: string; endsAt: string; daysLeft: number }[] }

const inp = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-400 focus:outline-none';
const lab = 'mb-1 block text-xs font-medium text-slate-400';
const SLOTS = ['classic', 'bold', 'minimal', 'warm'];
const ROLE_LABEL: Record<string, string> = { FREE_DEFAULT: 'Free design', MARKETPLACE: 'Marketplace' };
const STATUS_COLOR: Record<string, string> = { LIVE: 'text-emerald-300', DRAFT: 'text-amber-300', RETIRED: 'text-slate-500' };
const money = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const LEVEL_STYLE: Record<string, string> = { pass: 'text-emerald-300', warn: 'text-amber-300', error: 'text-red-300', info: 'text-sky-300' };
const LEVEL_WORD: Record<string, string> = { pass: 'PASS', warn: 'WARN', error: 'FAIL', info: 'NOTE' };

function Lines({ lines }: { lines: LintLine[] }) {
  return <ul className="space-y-1 text-sm">{lines.map((l, i) => <li key={i} className={LEVEL_STYLE[l.level] ?? 'text-slate-300'}><span className="mr-2 font-mono text-xs">{LEVEL_WORD[l.level] ?? l.level}</span>{l.text}</li>)}</ul>;
}

export default function ThemesAdmin() {
  const { user } = useAuth();
  const role = user?.adminRole ?? 'SUPER_ADMIN';
  const canEdit = role !== 'MARKETING';
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [check, setCheck] = useState<{ file: File; ok: boolean; lines: LintLine[]; contrast: { what: string; ratio: number | null; ok: boolean }[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [sel, setSel] = useState<Detail | null>(null);
  const [edit, setEdit] = useState<{ categories: string[]; role: string; replacesDesign: string; price: string; status: string; name: string } | null>(null);
  const [view, setView] = useState<{ category: string; device: 'desktop' | 'phone'; popup: boolean; links: { category: string; path: string }[] } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.adminThemes().then((r) => setRows((r.data ?? []) as ThemeRow[])).catch((e: Error) => setErr(e.message));
    api.adminPacks().then((r) => setPacks((r.data ?? []) as Pack[])).catch(() => setPacks([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canEdit) api.adminThemeReport().then((r) => setReport(r.data as Report)).catch(() => setReport(null)); }, [canEdit, rows.length]);

  const run = async (name: string, fn: () => Promise<unknown>, ok: string): Promise<void> => { setErr(''); setMsg(''); setBusy(name); try { await fn(); setMsg(ok); load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(''); } };

  const doCheck = async (f: File): Promise<void> => {
    setErr(''); setMsg(''); setCheck(null); setBusy('check');
    try { const r = await api.adminThemeImport(f, true); setCheck({ file: f, ok: r.ok, lines: r.lines, contrast: r.contrast ?? [] }); } catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };
  const doAdd = async (): Promise<void> => {
    if (!check) return;
    await run('add', async () => { const r = await api.adminThemeImport(check.file, false); if (!r.ok) throw new Error(r.lines.filter((l) => l.level === 'error').map((l) => l.text).join(' ') || 'The theme was not added.'); setCheck(null); if (file.current) file.current.value = ''; }, 'The theme was added as a draft. Open it to choose its categories, role and price, look at it on desktop and phone, then set it Live.');
  };

  const open = async (r: ThemeRow): Promise<void> => {
    setErr(''); setMsg('');
    try {
      const d = (await api.adminTheme(r.id)).data as Detail;
      setSel({ ...r, ...d });
      setEdit({ categories: d.categories ?? r.categories, role: d.role, replacesDesign: d.replacesDesign ?? '', price: d.priceYearlyPaise != null ? String(d.priceYearlyPaise / 100) : '', status: d.status, name: d.name });
      const links = (await api.adminThemePreviewLinks(r.id)).data as { category: string; path: string }[];
      setView({ category: links[0]?.category ?? '', device: 'desktop', popup: false, links });
    } catch (e) { setErr((e as Error).message); }
  };
  const save = async (): Promise<void> => {
    if (!sel || !edit) return;
    const price = edit.price.trim() === '' ? null : Math.round(Number(edit.price) * 100);
    if (price !== null && !Number.isFinite(price)) { setErr('Enter the yearly price in rupees, for example 999.'); return; }
    await run('save', () => api.adminThemeUpdate(sel.id, { categories: edit.categories, role: edit.role, replacesDesign: edit.role === 'FREE_DEFAULT' ? edit.replacesDesign || null : null, priceYearlyPaise: edit.role === 'MARKETPLACE' ? price : null, status: edit.status, name: edit.name }), 'Saved.');
    await open(sel);
  };
  const compatible = (t: Detail): Pack[] => packs.filter((p) => p.config.family && t.families.includes(p.config.family));
  const link = view?.links.find((l) => l.category === view.category);
  const src = link ? `${link.path}${view?.popup ? '&popup=1' : ''}` : '';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Theme marketplace</h1>
        <p className="text-sm text-slate-400">Upload a theme made by KSM, Bolt, v0 or Claude. It is checked and made safe, and shown on desktop and phone with sample content for every category it is for. Then choose: a free design that replaces one of the four built-in designs of a category, or a marketplace theme vendors buy for a year. No deploy needed.</p>
      </div>
      {err && <div role="alert" className="rounded-lg border border-red-700 bg-red-950/60 px-4 py-2 text-sm text-red-200">{err}</div>}
      {msg && <div className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-200">{msg}</div>}

      {canEdit && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Upload a theme (zip)</h2>
          <p className="mt-1 text-xs text-slate-400">Make the zip from the theme folder itself (theme.json, home.html and theme.css at the top). The same check runs on your computer with: node scripts/theme/lint.mjs &lt;folder&gt;</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input ref={file} type="file" accept=".zip,application/zip" className="text-sm text-slate-300" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doCheck(f); }} />
            {busy === 'check' && <span className="text-sm text-slate-400">Checking...</span>}
          </div>
          {check && (
            <div className="mt-4 space-y-3">
              <p className={`text-sm font-semibold ${check.ok ? 'text-emerald-300' : 'text-red-300'}`}>{check.ok ? 'No problems found. Nothing is stored yet.' : 'This upload was refused. Nothing was stored. Fix the lines marked FAIL and upload again.'}</p>
              <Lines lines={check.lines} />
              {check.ok && <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy === 'add'} onClick={() => void doAdd()}>Add to the marketplace as a draft</button>}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2">Theme</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Categories</th><th className="px-3 py-2">Price / year</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Licences</th><th className="px-3 py-2" /></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No themes yet. Upload one above.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="text-slate-200">
                <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.key} · version {r.version}{r.lintSummary.warnings ? ` · ${r.lintSummary.warnings} warning(s)` : ''}{r.lintSummary.contrastFails ? ' · contrast fails' : ''}</div></td>
                <td className="px-3 py-2">{ROLE_LABEL[r.role] ?? r.role}{r.role === 'FREE_DEFAULT' && r.replacesDesign ? <span className="text-xs text-slate-500"> (replaces {r.replacesDesign})</span> : null}</td>
                <td className="px-3 py-2 text-xs">{r.categories.join(', ')}</td>
                <td className="px-3 py-2">{r.role === 'MARKETPLACE' ? (r.priceYearlyPaise ? money(r.priceYearlyPaise) : <span className="text-amber-300">not set</span>) : 'Free'}</td>
                <td className={`px-3 py-2 ${STATUS_COLOR[r.status] ?? ''}`}>{r.status === 'LIVE' ? 'Live' : r.status === 'DRAFT' ? 'Draft' : 'Retired'}</td>
                <td className="px-3 py-2">{r.activeLicences}</td>
                <td className="space-x-3 px-3 py-2 text-right">
                  <button className="text-primary-300 underline" onClick={() => void open(r)}>{canEdit ? 'Open' : 'Preview'}</button>
                  {canEdit && <button className="text-primary-300 underline" onClick={() => { const k = window.prompt('Id for the copy (lower-case letters, numbers, dashes)', `${r.key}-copy`); if (k) void run('dup', () => api.adminThemeDuplicate(r.id, k), 'Copied as a draft.'); }}>Copy</button>}
                  {canEdit && r.status !== 'RETIRED' && <button className="text-primary-300 underline" onClick={() => { if (window.confirm(r.activeLicences ? `${r.activeLicences} vendor(s) own this theme. Their sites keep working until their year ends. Retire it?` : 'Retire this theme? Vendors will no longer see it.') ) void run('ret', () => api.adminThemeUpdate(r.id, { status: 'RETIRED' }), 'Retired. Sites that use it show their free design until they pick another.'); }}>Retire</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && edit && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold text-white">{sel.name} <span className="text-sm font-normal text-slate-500">{sel.key} · version {sel.version}</span></h2><button className="text-sm text-slate-400 underline" onClick={() => { setSel(null); setEdit(null); setView(null); }}>Close</button></div>
          {sel.manifest?.description && <p className="mt-1 text-sm text-slate-400">{sel.manifest.description}</p>}

          <div className="mt-4 grid gap-5 lg:grid-cols-[22rem_1fr]">
            <div className="space-y-4">
              <div><label className={lab}>Name vendors see</label><input className={inp} disabled={!canEdit} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div>
                <label className={lab}>Categories this theme is for</label>
                <div className="max-h-44 space-y-1 overflow-auto rounded-lg border border-slate-700 p-2">
                  {compatible(sel).map((p) => <label key={p.key} className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" disabled={!canEdit} checked={edit.categories.includes(p.key)} onChange={(e) => setEdit({ ...edit, categories: e.target.checked ? [...edit.categories, p.key] : edit.categories.filter((c) => c !== p.key) })} />{p.name}</label>)}
                  {compatible(sel).length === 0 && <p className="text-xs text-slate-500">No category matches the kinds of business this theme was built for ({sel.families.join(', ')}).</p>}
                </div>
                <p className="mt-1 text-xs text-slate-500">A theme works only for the kinds of business it was built for ({sel.families.join(', ')}).</p>
              </div>
              <div><label className={lab}>Role</label><select className={inp} disabled={!canEdit} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}><option value="FREE_DEFAULT">Free design for the category</option><option value="MARKETPLACE">Marketplace theme (vendors pay for a year)</option></select></div>
              {edit.role === 'FREE_DEFAULT'
                ? <div><label className={lab}>Replaces which built-in design</label><select className={inp} disabled={!canEdit} value={edit.replacesDesign} onChange={(e) => setEdit({ ...edit, replacesDesign: e.target.value })}><option value="">Choose</option>{SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}</select><p className="mt-1 text-xs text-slate-500">A category always shows four free designs; this one takes the place of the one you choose.</p></div>
                : <div><label className={lab}>Price for one year, in rupees (before 18 percent GST)</label><input className={inp} disabled={!canEdit} inputMode="decimal" value={edit.price} placeholder="for example 999" onChange={(e) => setEdit({ ...edit, price: e.target.value })} />{edit.price && Number(edit.price) > 0 && <p className="mt-1 text-xs text-slate-400">Vendors pay {money(Math.round(Number(edit.price) * 100) + Math.round(Number(edit.price) * 18))} with GST.</p>}</div>}
              <div><label className={lab}>Status</label><select className={inp} disabled={!canEdit} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option value="DRAFT">Draft (only you can see it)</option><option value="LIVE">Live</option><option value="RETIRED">Retired</option></select></div>
              {canEdit && <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy === 'save'} onClick={() => void save()}>Save</button>}
            </div>

            <div>
              {view && view.links.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100" value={view.category} onChange={(e) => setView({ ...view, category: e.target.value })}>{view.links.map((l) => <option key={l.category} value={l.category}>{packs.find((p) => p.key === l.category)?.name ?? l.category}</option>)}</select>
                    <div className="inline-flex rounded-lg border border-slate-700 p-0.5 text-sm">
                      <button className={`rounded-md px-3 py-1 ${view.device === 'desktop' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} onClick={() => setView({ ...view, device: 'desktop' })}>Desktop</button>
                      <button className={`rounded-md px-3 py-1 ${view.device === 'phone' ? 'bg-slate-700 text-white' : 'text-slate-400'}`} onClick={() => setView({ ...view, device: 'phone' })}>Phone</button>
                    </div>
                    <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200" onClick={() => setView({ ...view, popup: !view.popup })}>{view.popup ? 'Close the popup' : 'Open the popup'}</button>
                    <a className="text-sm text-primary-300 underline" href={src} target="_blank" rel="noopener noreferrer">Open in a new tab</a>
                  </div>
                  <div className={`mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 ${view.device === 'phone' ? 'mx-auto w-[390px] max-w-full' : 'w-full'}`}>
                    <iframe key={`${src}${view.device}`} title="Theme preview" src={src} className={`block w-full border-0 bg-white ${view.device === 'phone' ? 'h-[720px]' : 'h-[560px]'}`} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Sample content only. The bottom bar shows on the phone; the popup shows its steps but sends nothing.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div><h3 className="mb-2 text-sm font-semibold text-white">What the check said when it was uploaded</h3>{sel.lint?.lines?.length ? <Lines lines={sel.lint.lines} /> : <p className="text-sm text-slate-500">Nothing recorded.</p>}</div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white">Colour contrast</h3>
              {sel.lint?.contrast?.length ? <ul className="space-y-1 text-sm">{sel.lint.contrast.map((c) => <li key={c.what} className={c.ok ? 'text-emerald-300' : 'text-red-300'}>{c.ok ? 'PASS' : 'FAIL'} {c.what}: {c.ratio ? `${c.ratio.toFixed(1)} to 1` : 'not checked'} (needs 4.5 to 1)</li>)}</ul> : <p className="text-sm text-slate-500">The theme gave no colours, so contrast could not be checked. Add "colors" to theme.json.</p>}
              {sel.pageNames && <p className="mt-3 text-xs text-slate-500">Pages: {sel.pageNames.join(', ')}</p>}
            </div>
          </div>
        </div>
      )}

      {canEdit && report && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Sales</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-4">
            <div><div className="text-xs text-slate-400">Years sold</div><div className="text-lg font-semibold">{report.totals.sold}</div></div>
            <div><div className="text-xs text-slate-400">Licences active now</div><div className="text-lg font-semibold">{report.totals.active}</div></div>
            <div><div className="text-xs text-slate-400">Revenue (before GST)</div><div className="text-lg font-semibold">{money(report.totals.revenuePaise)}</div></div>
            <div><div className="text-xs text-slate-400">GST collected</div><div className="text-lg font-semibold">{money(report.totals.gstPaise)}</div></div>
          </div>
          {report.perTheme.length > 0 && <table className="mt-4 w-full text-left text-sm text-slate-200"><thead className="text-xs uppercase text-slate-400"><tr><th className="py-1">Theme</th><th>Sold</th><th>Active</th><th>Revenue</th></tr></thead><tbody>{report.perTheme.map((t) => <tr key={t.key} className="border-t border-slate-800"><td className="py-1.5">{t.name}</td><td>{t.sold}</td><td>{t.active}</td><td>{money(t.revenuePaise)}</td></tr>)}</tbody></table>}
          {report.expiringSoon.length > 0 && (
            <div className="mt-4"><h3 className="text-sm font-semibold text-white">Licences ending within 30 days</h3><ul className="mt-2 space-y-1 text-sm text-slate-300">{report.expiringSoon.map((e) => <li key={`${e.vendorId}${e.themeName}`}>{e.businessName}: {e.themeName}, {e.daysLeft} day{e.daysLeft === 1 ? '' : 's'} left ({new Date(e.endsAt).toLocaleDateString('en-IN')})</li>)}</ul></div>
          )}
        </div>
      )}
    </div>
  );
}
