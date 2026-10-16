'use client';

import { DEFAULT_SHELL } from '@/engine/shell/build-shell';
import type { PackShell, PopupStep, PopupStepKind } from '@/engine/shell/types';

/**
 * The shell of a category pack: the words the business uses, the five buttons of the phone's bottom bar, and the steps of the main-action popup. All data, so a new category
 * needs no code. Empty means the family's standard shell is used. Validated again by the server (exactly five slots, a details step, and so on).
 */
const inp = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary-400 focus:outline-none';
const lab = 'mb-1 block text-xs font-medium text-slate-400';
const ICONS = ['home', 'grid', 'book', 'users', 'more', 'menu', 'order', 'cart', 'offers', 'building', 'enquiry', 'visit', 'courses', 'programs', 'contact', 'gallery', 'services', 'products', 'info', 'camera', 'quote', 'plans'];
const TARGETS = ['home', 'items', 'team', 'gallery', 'about', 'contact', 'action', 'cart', 'more'];
const KINDS: { v: PopupStepKind; l: string }[] = [{ v: 'choose', l: 'Choose one' }, { v: 'when', l: 'Date and time' }, { v: 'dates', l: 'From and to dates' }, { v: 'count', l: 'How many' }, { v: 'mode', l: 'What kind (options)' }, { v: 'cart', l: 'Cart (shops)' }, { v: 'details', l: 'Name and phone' }, { v: 'confirm', l: 'Check and send' }];

export function ShellFields({ shell, setShell }: { shell: PackShell | undefined; setShell: (s: PackShell | undefined) => void }) {
  if (!shell) {
    return (
      <div className="space-y-2 md:col-span-2">
        <h3 className="text-sm font-semibold text-white">Words, phone bar and popup</h3>
        <p className="text-xs text-slate-400">This category uses its family&apos;s standard words, bottom bar and popup. Customise them to change what this kind of business calls its team and items, which five buttons the phone bar shows, and what the popup asks.</p>
        <button type="button" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => setShell(JSON.parse(JSON.stringify(DEFAULT_SHELL)) as PackShell)}>Customise</button>
      </div>
    );
  }
  const setT = (k: keyof PackShell['terms'], v: string): void => setShell({ ...shell, terms: { ...shell.terms, [k]: v } });
  const setNav = (i: number, p: Partial<PackShell['bottomNav'][number]>): void => setShell({ ...shell, bottomNav: shell.bottomNav.map((n, j) => (j === i ? { ...n, ...p } : n)) });
  const steps = shell.popup.steps;
  const setStep = (i: number, p: Partial<PopupStep>): void => setShell({ ...shell, popup: { ...shell.popup, steps: steps.map((s, j) => (j === i ? { ...s, ...p } : s)) } });
  const move = (i: number, d: number): void => { const j = i + d; if (j < 0 || j >= steps.length) return; const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]; setShell({ ...shell, popup: { ...shell.popup, steps: next } }); };
  return (
    <div className="space-y-5 md:col-span-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Words, phone bar and popup</h3><button type="button" className="text-xs text-slate-400 underline" onClick={() => setShell(undefined)}>Go back to the family standard</button></div>

      <div>
        <p className="mb-2 text-xs text-slate-400">The words this kind of business uses. They appear in the editor, the footer, the bar and the popup.</p>
        <div className="grid gap-3 sm:grid-cols-5">
          {([['team', 'The team (plural)'], ['teamOne', 'One team member'], ['items', 'The items (plural)'], ['itemOne', 'One item'], ['groups', 'The groups']] as const).map(([k, l]) => <div key={k}><label className={lab}>{l}</label><input className={inp} maxLength={40} value={shell.terms[k]} onChange={(e) => setT(k, e.target.value)} /></div>)}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-slate-400">The five buttons of the bottom bar on a phone. The middle one (3rd) must be the main action or the cart.</p>
        <div className="grid gap-3 sm:grid-cols-5">
          {shell.bottomNav.map((n, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-slate-700 p-2">
              <label className={lab}>{i === 2 ? 'Middle button' : `Button ${i + 1}`}</label>
              <input className={inp} maxLength={14} value={n.label} onChange={(e) => setNav(i, { label: e.target.value })} />
              <select className={inp} value={n.icon} onChange={(e) => setNav(i, { icon: e.target.value })}>{ICONS.map((x) => <option key={x}>{x}</option>)}</select>
              <select className={inp} value={n.target.startsWith('page:') ? 'page' : n.target} onChange={(e) => setNav(i, { target: e.target.value === 'page' ? 'page:offers' : e.target.value })}>{TARGETS.map((x) => <option key={x}>{x}</option>)}<option value="page">a page of the site</option></select>
              {n.target.startsWith('page:') && <input className={inp} placeholder="page address" value={n.target.slice(5)} onChange={(e) => setNav(i, { target: `page:${e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')}` })} />}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lab}>Popup title</label><input className={inp} maxLength={60} value={shell.popup.title} onChange={(e) => setShell({ ...shell, popup: { ...shell.popup, title: e.target.value } })} /></div>
          <div><label className={lab}>Default thank-you message</label><input className={inp} maxLength={300} value={shell.popup.confirm} onChange={(e) => setShell({ ...shell, popup: { ...shell.popup, confirm: e.target.value } })} /></div>
        </div>
        <p className="mb-2 mt-3 text-xs text-slate-400">The steps of the popup, in order (1 to 8). One must ask for name and phone. “Choose one” can list the vendor&apos;s items, the team, or options you type (one per line).</p>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-700 p-2 md:grid-cols-[9rem_1fr_9rem_auto]">
              <select className={inp} value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as PopupStepKind })}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
              <input className={inp} maxLength={60} placeholder="Question or heading" value={s.label} onChange={(e) => setStep(i, { label: e.target.value })} />
              {s.kind === 'choose' ? <select className={inp} value={s.source ?? 'items'} onChange={(e) => setStep(i, { source: e.target.value as 'items' })}><option value="items">The vendor&apos;s items</option><option value="team">The team</option><option value="options">Options I type</option></select> : <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={!!s.required} onChange={(e) => setStep(i, { required: e.target.checked })} />Required</label>}
              <div className="flex items-center gap-2 text-xs text-slate-400"><button type="button" aria-label="Move up" onClick={() => move(i, -1)}>↑</button><button type="button" aria-label="Move down" onClick={() => move(i, 1)}>↓</button><button type="button" aria-label="Remove step" className="text-red-300" onClick={() => setShell({ ...shell, popup: { ...shell.popup, steps: steps.filter((_, j) => j !== i) } })}>Remove</button></div>
              {(s.kind === 'mode' || s.kind === 'when' || (s.kind === 'choose' && s.source === 'options')) && <textarea rows={2} className={`${inp} md:col-span-4`} placeholder="Options, one per line" value={(s.options ?? []).join('\n')} onChange={(e) => setStep(i, { options: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />}
            </div>
          ))}
          {steps.length < 8 && <button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200" onClick={() => setShell({ ...shell, popup: { ...shell.popup, steps: [...steps, { key: `step${steps.length + 1}`, kind: 'choose', label: 'Choose one', source: 'options', options: [] }] } })}>Add a step</button>}
        </div>
      </div>
    </div>
  );
}
