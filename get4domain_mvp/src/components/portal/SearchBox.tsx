'use client';

import { Globe, MapPin, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { btn, FOCUS, INPUT, LABEL } from '@/components/portal/ui';
import { suggest, type Trees } from '@/lib/v3-public/portal-search';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { subdomainProblem, type SubdomainState } from '@/lib/v3-public/register';

interface Option { key: string; label: string; hint: string | null; value: string; slug: string }

/** One text field with a suggestion list (the combobox pattern): arrow keys move, Enter picks, Escape closes; a pick fills the field and remembers the exact slug. */
function SuggestInput({ id, label, placeholder, value, onChange, onPick, options, icon }: {
  id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void; onPick: (o: Option) => void; options: Option[]; icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `${id}-list`;
  const show = open && options.length > 0;
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
            if (!show) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
            else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); onPick(options[active]); setOpen(false); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          className={`${INPUT} pl-10`}
        />
      </div>
      {show ? (
        <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-premium">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? 'bg-brand-50 text-brand-800' : 'text-slate-800'}`}
            >
              <span>{o.label}</span>
              {o.hint ? <span className="text-xs text-slate-500">{o.hint}</span> : null}
            </li>
          ))}
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

/** The two-mode search of the portal. One component for the home hero and the directory: the same fields, the same suggestions, the same address. */
export default function SearchBox({ action, registerHref, suffix, initial, defaultMode = 'business', showDomain = true, idPrefix }: SearchBoxProps) {
  const auto = useId().replace(/:/g, '');
  const pre = idPrefix ?? `sb${auto}`;
  const [mode, setMode] = useState<'business' | 'domain'>(defaultMode);
  const [what, setWhat] = useState(initial?.what ?? '');
  const [where, setWhere] = useState(initial?.where ?? '');
  const [c, setC] = useState(initial?.c ?? '');
  const [l, setL] = useState(initial?.l ?? '');
  const [trees, setTrees] = useState<Trees | null>(null);
  const asked = useRef(false);

  const load = (): void => {
    if (asked.current) return;
    asked.current = true;
    fetch('/directory-api/suggest', { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Trees | null) => { if (j && Array.isArray(j.places) && Array.isArray(j.categories)) setTrees(j); })
      .catch(() => { asked.current = false; });
  };

  const whatOptions = useMemo<Option[]>(() => {
    if (!trees) return [];
    return suggest(trees, what).categories.map((x) => ({ key: `c-${x.slug}`, label: x.name, hint: PORTAL.search.suggestCategories, value: x.name, slug: x.slug }));
  }, [trees, what]);
  const whereOptions = useMemo<Option[]>(() => {
    if (!trees) return [];
    return suggest(trees, where).places.map((x) => ({ key: `p-${x.path}`, label: x.label, hint: null, value: x.name, slug: x.path }));
  }, [trees, where]);

  // domain mode: the local rules answer at once, the server is asked once the visitor pauses
  const [sub, setSub] = useState('');
  const [state, setState] = useState<SubdomainState | 'checking' | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const s = sub.trim().toLowerCase();
    if (!s) { setState(null); return; }
    const local = subdomainProblem(s);
    if (local === 'subdomainInvalid') { setState('invalid'); return; }
    if (local === 'subdomainShort') { setState('short'); return; }
    const mine = ++seq.current;
    setState('checking');
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/directory-api/subdomain?slug=${encodeURIComponent(s)}`, { cache: 'no-store' });
        const j = (await r.json()) as { state?: SubdomainState };
        if (mine === seq.current) setState(j.state ?? 'unknown');
      } catch {
        if (mine === seq.current) setState('unknown');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [sub]);

  const T = PORTAL.search;
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

  const stateText = state === 'checking' ? T.checking : state ? T.state[state] : '';
  const stateBad = state === 'taken' || state === 'reserved' || state === 'invalid' || state === 'short';
  const subClean = sub.trim().toLowerCase();

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
          <form role={showDomain ? 'tabpanel' : 'search'} id={`${pre}-panel-business`} aria-labelledby={showDomain ? `${pre}-tab-business` : undefined} action={action} method="get" onFocusCapture={load}>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
              <SuggestInput id={`${pre}-what`} label={T.whatLabel} placeholder={T.whatPlaceholder} value={what} icon={<Search className="h-4 w-4" />} options={whatOptions}
                onChange={(v) => { setWhat(v); setC(''); }} onPick={(o) => { setWhat(o.value); setC(o.slug); }} />
              <SuggestInput id={`${pre}-where`} label={T.whereLabel} placeholder={T.wherePlaceholder} value={where} icon={<MapPin className="h-4 w-4" />} options={whereOptions}
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
                  onChange={(e) => setSub(e.target.value)} aria-describedby={`${pre}-sub-status`} aria-invalid={stateBad}
                  className="min-w-0 flex-1 rounded-l-xl bg-transparent px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
                />
                {suffix ? <span className="flex items-center rounded-r-xl bg-slate-100 px-3 text-sm text-slate-700">{suffix}</span> : null}
              </div>
              {state === 'available'
                ? <a href={`${registerHref}${registerHref.includes('?') ? '&' : '?'}subdomain=${encodeURIComponent(subClean)}`} className={btn('primary')}>{T.createSite}</a>
                : null}
            </div>
            <p id={`${pre}-sub-status`} role="status" aria-live="polite" className={`mt-2 min-h-[1.25rem] text-sm ${stateBad ? 'text-red-700' : state === 'available' ? 'text-emerald-800' : 'text-slate-600'}`}>{stateText}</p>
            <p className="text-xs text-slate-600">{T.domainHelper}</p>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink-900">{T.customLabel}</p>
              <p className="mt-1 text-sm text-slate-600">{T.customNote}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor={`${pre}-own`} className="sr-only">{T.customLabel}</label>
                <input id={`${pre}-own`} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={T.customPlaceholder} className={INPUT} />
                <a href={registerHref} className={`${btn('secondary')} shrink-0`}>{T.customCta}</a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
