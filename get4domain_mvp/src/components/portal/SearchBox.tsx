'use client';

import { Globe, MapPin, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { btn, FOCUS, INPUT, LABEL } from '@/components/portal/ui';
import type { DomainAnswer } from '@/lib/v3-public/domain-availability';
import { SUGGEST_MIN, type SuggestType, type Suggestions } from '@/lib/v3-public/portal-search';
import { PORTAL } from '@/lib/v3-public/portal-strings';

interface Option { key: string; label: string; hint: string | null; value: string; slug: string; group: string | null }
type SuggestState = 'idle' | 'loading' | 'ok' | 'error';

/** Typed text to the suggest route, after a short pause; a newer keystroke cancels the older call. Under two letters nothing is asked. A failed call is `error`, never an empty list. */
function useSuggest(text: string, types: readonly SuggestType[]): { state: SuggestState; data: Suggestions | null } {
  const [res, setRes] = useState<{ state: SuggestState; data: Suggestions | null }>({ state: 'idle', data: null });
  const kinds = types.join(',');
  useEffect(() => {
    const q = text.trim();
    if (q.length < SUGGEST_MIN) { setRes({ state: 'idle', data: null }); return; }
    const ctl = new AbortController();
    setRes((r) => ({ state: 'loading', data: r.data }));
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/directory-api/suggest?q=${encodeURIComponent(q)}&type=${encodeURIComponent(kinds)}`, { cache: 'no-store', signal: ctl.signal });
        if (!r.ok) throw new Error('suggest');
        setRes({ state: 'ok', data: (await r.json()) as Suggestions });
      } catch {
        if (!ctl.signal.aborted) setRes({ state: 'error', data: null });
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text, kinds]);
  return res;
}

/** One text field with a suggestion list (the combobox pattern): arrow keys move, Enter picks, Escape closes; a pick fills the field and remembers the exact slug. The list also says, in words, when it is loading, has nothing, or could not be fetched. */
function SuggestInput({ id, label, placeholder, value, onChange, onPick, options, icon, state }: {
  id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; onPick: (o: Option) => void; options: Option[]; icon: React.ReactNode; state: SuggestState;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `${id}-list`;
  const T = PORTAL.search;
  const note = state === 'loading' && options.length === 0 ? T.suggestLoading : state === 'error' ? T.suggestError : state === 'ok' && options.length === 0 ? T.suggestEmpty : null;
  const show = open && (options.length > 0 || note !== null);
  return (
    <div className="relative">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!show || options.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
            else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); onPick(options[active]); setOpen(false); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          className={`${INPUT} pl-10`}
        />
      </div>
      {show ? (
        <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-premium">
          {options.map((o, i) => (
            <li key={o.key} role="presentation">
              {o.group && (i === 0 || options[i - 1].group !== o.group) ? <p aria-hidden="true" className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{o.group}</p> : null}
              <div
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? 'bg-brand-50 text-brand-800' : 'text-slate-800'}`}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {o.hint ? <span className="shrink-0 text-xs text-slate-500">{o.hint}</span> : null}
              </div>
            </li>
          ))}
          {note ? <li role="presentation"><p role="status" className="px-4 py-2 text-sm text-slate-600">{note}</p></li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export interface SearchBoxProps {
  /** where the business search goes (the directory search page; absolute when the directory is its own host) */
  action: string;
  /** the register page, for "Create this site" and "Connect a domain you own" */
  registerHref: string;
  /** ".get4domain.com", or "" when the base domain is not known */
  suffix: string;
  initial?: { what?: string; where?: string; c?: string; l?: string };
  defaultMode?: 'business' | 'domain';
  /** the domain tab is left out on the directory pages */
  showDomain?: boolean;
  idPrefix?: string;
}

const PIN = /^[1-9][0-9]{5}$/;
const fill = (t: string, vars: Record<string, string>): string => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t);

type DomainView = { phase: 'idle' } | { phase: 'checking' } | { phase: 'failed' } | { phase: 'done'; answer: DomainAnswer; typed: string };

/** The two-mode search of the portal. One component for the home hero and the directory: the same fields, the same suggestions, the same address. */
export default function SearchBox({ action, registerHref, suffix, initial, defaultMode = 'business', showDomain = true, idPrefix }: SearchBoxProps) {
  const auto = useId().replace(/:/g, '');
  const pre = idPrefix ?? `sb${auto}`;
  const [mode, setMode] = useState<'business' | 'domain'>(defaultMode);
  const [what, setWhat] = useState(initial?.what ?? '');
  const [where, setWhere] = useState(initial?.where ?? '');
  const [c, setC] = useState(initial?.c ?? '');
  const [l, setL] = useState(initial?.l ?? '');

  const whatTypes = useMemo<SuggestType[]>(() => ['business', 'category'], []);
  const whereTypes = useMemo<SuggestType[]>(() => ['place'], []);
  const whatS = useSuggest(c ? '' : what, whatTypes);
  const whereS = useSuggest(l ? '' : where, whereTypes);

  const T = PORTAL.search;
  const whatOptions = useMemo<Option[]>(() => {
    const d = whatS.data;
    if (!d) return [];
    return [
      ...d.categories.map((x) => ({ key: `c-${x.slug}`, label: x.name, hint: x.kind === 'subcategory' && x.parent ? fill(T.suggestSubcategory, { parent: x.parent }) : null, value: x.name, slug: x.slug, group: T.suggestCategories })),
      ...d.businesses.map((x) => ({ key: `b-${x.slug}`, label: x.name, hint: [x.category, x.city].filter(Boolean).join(', ') || null, value: x.name, slug: '', group: T.suggestBusinesses })),
    ];
  }, [whatS.data, T]);
  const whereOptions = useMemo<Option[]>(() => {
    const pin = where.replace(/\s+/g, '');
    const typedPin: Option[] = PIN.test(pin) ? [{ key: 'pin', label: fill(T.suggestPincode, { code: pin }), hint: null, value: pin, slug: '', group: null }] : [];
    const places = whereS.data?.places.map((x) => ({ key: `p-${x.path}`, label: x.label || x.name, hint: null, value: x.name, slug: x.path, group: null })) ?? [];
    return [...typedPin, ...places];
  }, [whereS.data, where, T]);

  // domain mode: one typed name, asked of the domain-availability route once the visitor pauses
  const [sub, setSub] = useState('');
  const [view, setView] = useState<DomainView>({ phase: 'idle' });
  useEffect(() => {
    const typed = sub.trim().toLowerCase();
    if (!typed) { setView({ phase: 'idle' }); return; }
    const ctl = new AbortController();
    setView({ phase: 'checking' });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/directory-api/domain-availability?name=${encodeURIComponent(typed)}`, { cache: 'no-store', signal: ctl.signal });
        const a = (await r.json()) as DomainAnswer;
        setView(r.ok && a.ok ? { phase: 'done', answer: a, typed } : { phase: 'failed' });
      } catch {
        if (!ctl.signal.aborted) setView({ phase: 'failed' });
      }
    }, 450);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [sub]);

  const tab = (m: 'business' | 'domain', text: string, icon: React.ReactNode): React.ReactNode => (
    <button
      type="button"
      role="tab"
      id={`${pre}-tab-${m}`}
      aria-selected={mode === m}
      aria-controls={`${pre}-panel-${m}`}
      onClick={() => setMode(m)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-t-2xl px-3 py-3 text-sm font-semibold sm:flex-none sm:px-5 ${FOCUS} ${mode === m ? 'bg-white text-brand-700' : 'bg-white/60 text-slate-700 hover:bg-white/80'}`}
    >
      {icon}{text}
    </button>
  );

  const D = T.domain;
  const answer = view.phase === 'done' ? view.answer : null;
  const subRow = ((): { text: string; tone: 'good' | 'bad' | 'plain'; warn: string | null; create: string | null } | null => {
    if (view.phase === 'checking') return { text: T.checking, tone: 'plain', warn: null, create: null };
    if (view.phase === 'failed') return { text: D.unreachable, tone: 'plain', warn: null, create: null };
    const s = answer?.subdomain;
    if (!s) return null;
    const name = `${(s.name ?? answer?.name ?? '').split('.')[0]}${suffix}`;
    if (s.state === 'AVAILABLE') return { text: fill(D.available, { name }), tone: 'good', warn: s.similarTo ? fill(D.similar, { similar: s.similarTo }) : null, create: s.name };
    if (s.state === 'TAKEN') return { text: fill(D.taken, { name }), tone: 'bad', warn: null, create: null };
    if (s.state === 'RESERVED') return { text: fill(D.reserved, { name }), tone: 'bad', warn: null, create: null };
    return { text: D.invalid, tone: 'bad', warn: null, create: null };
  })();
  const customRows = ((): string[] => {
    const cd = answer?.custom;
    if (!cd) return [];
    // "available" is said only for a row the API itself marked AVAILABLE
    if (cd.state === 'REGISTRAR_OFF') return [D.registrarOff];
    if (cd.state === 'AVAILABLE' || cd.state === 'TAKEN') {
      const rows = cd.results.map((r) => (r.state === 'AVAILABLE' ? fill(D.customAvailable, { domain: r.domain }) : r.state === 'TAKEN' ? fill(D.customTaken, { domain: r.domain }) : D.customUnknown));
      return rows.length ? rows : [D.customUnknown];
    }
    if (cd.state === 'NOT_FOR_SALE') return [D.customNotForSale];
    if (cd.state === 'INVALID') return [D.customInvalid];
    return [D.customUnknown];
  })();

  return (
    <div className="w-full min-w-0">
      {showDomain ? (
        <div role="tablist" aria-label={T.tabsLabel} className="flex gap-1">
          {tab('business', T.tabBusiness, <Search aria-hidden="true" className="h-4 w-4" />)}
          {tab('domain', T.tabDomain, <Globe aria-hidden="true" className="h-4 w-4" />)}
        </div>
      ) : null}
      <div className={`bg-white p-4 shadow-premium sm:p-5 ${showDomain ? 'rounded-b-2xl rounded-tr-2xl' : 'rounded-2xl'}`}>
        {mode === 'business' ? (
          <form role={showDomain ? 'tabpanel' : 'search'} id={`${pre}-panel-business`} aria-labelledby={showDomain ? `${pre}-tab-business` : undefined} action={action} method="get">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
              <SuggestInput id={`${pre}-what`} label={T.whatLabel} placeholder={T.whatPlaceholder} value={what} icon={<Search className="h-4 w-4" />} options={whatOptions} state={c ? 'idle' : whatS.state}
                onChange={(v) => { setWhat(v); setC(''); }} onPick={(o) => { setWhat(o.value); setC(o.slug); }} />
              <SuggestInput id={`${pre}-where`} label={T.whereLabel} placeholder={T.wherePlaceholder} value={where} icon={<MapPin className="h-4 w-4" />} options={whereOptions} state={l ? 'idle' : whereS.state}
                onChange={(v) => { setWhere(v); setL(''); }} onPick={(o) => { setWhere(o.value); setL(o.slug); }} />
              <button type="submit" className={`${btn('primary')} h-[50px] w-full md:w-auto`}><Search aria-hidden="true" className="h-4 w-4" />{T.submit}</button>
            </div>
            <input type="hidden" name="what" value={what} />
            <input type="hidden" name="where" value={where} />
            {c ? <input type="hidden" name="c" value={c} /> : null}
            {l ? <input type="hidden" name="l" value={l} /> : null}
            <p className="mt-3 text-xs text-slate-600">{T.helper}</p>
            <p className="sr-only">{T.suggestHint}</p>
          </form>
        ) : (
          <div role="tabpanel" id={`${pre}-panel-domain`} aria-labelledby={`${pre}-tab-domain`}>
            <label htmlFor={`${pre}-sub`} className={LABEL}>{T.domainLabel}</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-stretch rounded-xl border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-brand-600 focus-within:ring-offset-2">
                <input
                  id={`${pre}-sub`} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={sub} placeholder={T.domainPlaceholder}
                  onChange={(e) => setSub(e.target.value)} aria-describedby={`${pre}-sub-status ${pre}-custom-status`} aria-invalid={subRow?.tone === 'bad'}
                  className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              {subRow?.create ? <a href={`${registerHref}${registerHref.includes('?') ? '&' : '?'}subdomain=${encodeURIComponent(subRow.create)}`} className={btn('primary')}>{T.createSite}</a> : null}
            </div>
            <p className="text-xs text-slate-600 mt-2">{T.domainHelper}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink-900">{D.subHeading}</p>
                <p id={`${pre}-sub-status`} role="status" aria-live="polite" className={`mt-1 min-h-[1.25rem] text-sm ${subRow?.tone === 'bad' ? 'text-red-700' : subRow?.tone === 'good' ? 'text-emerald-800' : 'text-slate-600'}`}>{subRow?.text ?? ''}</p>
                {subRow?.warn ? <p role="note" className="mt-1 text-sm text-amber-800">{subRow.warn}</p> : null}
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink-900">{D.customHeading}</p>
                <div id={`${pre}-custom-status`} role="status" aria-live="polite" className="mt-1 min-h-[1.25rem] text-sm text-slate-700">
                  {customRows.map((t, i) => <p key={i}>{t}</p>)}
                </div>
                <a href={registerHref} className={`${btn('secondary')} mt-3`}>{T.customCta}</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
