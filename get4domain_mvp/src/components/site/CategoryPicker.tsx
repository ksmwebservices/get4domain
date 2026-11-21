'use client';

import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { familyLabel, groupByFamily, type CatOption } from '@/lib/v3-public/register-plan';
import { SITE } from '@/lib/v3-public/site-strings';

interface Props {
  id: string;
  options: readonly CatOption[];
  value: string;
  onPick: (c: CatOption) => void;
  invalid: boolean;
  describedBy?: string;
  /** shown under the list inside the sheet, for example the "My business isn't here" button */
  footer?: React.ReactNode;
  /** the line above the list, for example "Showing the categories of the Handyman plan" */
  note?: string | null;
}

const P = SITE.register.picker;

/**
 * The category picker: a button that opens a sheet (a bottom sheet on a phone, a centred panel on a larger screen) with a search box and the categories grouped by family.
 * It replaces a long native list: every row is a large touch target, the search narrows by word, and a category's sub category line is shown when the data has one.
 * Keyboard: Escape closes, the search box is focused on open, and focus returns to the button after a pick.
 */
export default function CategoryPicker({ id, options, value, onPick, invalid, describedBy, footer, note }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dlg = useId().replace(/:/g, '');
  const selected = options.find((c) => c.key === value) ?? null;
  const groups = useMemo(() => groupByFamily(options, query), [options, query]);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    // the page behind the sheet does not scroll while it is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = (): void => { setOpen(false); setQuery(''); trigger.current?.focus(); };

  return (
    <div>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dlg : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onClick={() => setOpen(true)}
        className="mt-1 flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-500'}>{selected ? selected.name : P.placeholder}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {selected ? <p className="mt-1 text-xs text-slate-500">{familyLabel(selected.family)}{selected.sub ? `, ${selected.sub}` : ''}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 sm:items-center sm:justify-center" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div
            id={dlg}
            role="dialog"
            aria-modal="true"
            aria-label={P.dialogLabel}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
            className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 p-3">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <label htmlFor={`${dlg}-q`} className="sr-only">{P.searchLabel}</label>
                <input ref={search} id={`${dlg}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={P.searchLabel} autoComplete="off" className="min-h-[44px] w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <button type="button" onClick={close} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900" aria-label={P.close}><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            {note ? <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">{note}</p> : null}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              {groups.length === 0 ? <p role="status" className="px-4 py-6 text-sm text-slate-600">{P.noMatch}</p> : null}
              {groups.map((g) => (
                <section key={g.family} aria-label={g.family}>
                  <h3 className="sticky top-0 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{g.family}</h3>
                  <ul>
                    {g.items.map((c) => (
                      <li key={c.key}>
                        <button
                          type="button"
                          aria-pressed={c.key === value}
                          onClick={() => { onPick(c); close(); }}
                          className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-100 focus:outline-none ${c.key === value ? 'font-semibold text-slate-900' : 'text-slate-800'}`}
                        >
                          <span className="min-w-0">
                            <span className="block">{c.name}</span>
                            {c.sub ? <span className="block text-xs font-normal text-slate-500">{c.sub}</span> : null}
                          </span>
                          {c.key === value ? <Check aria-label={P.selected} className="h-4 w-4 shrink-0" /> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {footer ? <div className="border-t border-slate-200 p-3">{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
