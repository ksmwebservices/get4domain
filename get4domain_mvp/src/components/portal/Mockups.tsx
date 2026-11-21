import type { ReactNode } from 'react';
import { PORTAL } from '@/lib/v3-public/portal-strings';

/**
 * Device frames and screen layouts drawn in HTML and CSS (dispatch J1). They show how the business app and a site are laid out: labels and shapes only,
 * never a made-up customer, number, price or review. Every frame is labelled "Preview" and hidden from screen readers (the text next to it carries the meaning).
 */
const bar = (w: string, tone = 'bg-slate-200'): ReactNode => <i className={`block h-1.5 rounded-full ${w} ${tone}`} />;

function Label({ children, tone = 'bg-brand-100 text-brand-800' }: { children: ReactNode; tone?: string }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${tone}`}>{children}</span>;
}

export function BrowserFrame({ address, children, className = '' }: { address?: string; children: ReactNode; className?: string }) {
  return (
    <figure aria-hidden="true" className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-device ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2">
        <i className="h-2 w-2 rounded-full bg-ruby-400" /><i className="h-2 w-2 rounded-full bg-gold-400" /><i className="h-2 w-2 rounded-full bg-success-400" />
        <span className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-500">{address ?? 'yourbusiness.get4domain.com'}</span>
        <span className="rounded bg-ink-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">{PORTAL.home.preview}</span>
      </div>
      {children}
    </figure>
  );
}

export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <figure aria-hidden="true" className={`relative mx-auto w-44 rounded-[1.75rem] border-[6px] border-ink-900 bg-white shadow-device-phone ${className}`}>
      <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-ink-700" />
      <div className="px-2.5 pb-3 pt-2">{children}</div>
      <span className="absolute -top-2 right-3 rounded bg-ink-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">{PORTAL.home.preview}</span>
    </figure>
  );
}

/** The business app: a menu on the left, summary tiles, a chart outline and a list. */
export function DashboardScreen() {
  const items = ['Home', 'Customers', 'Orders', 'Invoices', 'Reports'];
  return (
    <div className="flex bg-slate-50">
      <div className="hidden w-28 shrink-0 space-y-1 border-r border-slate-200 bg-white p-2 sm:block">
        {items.map((t, i) => <p key={t} className={`rounded-md px-2 py-1 text-[10px] font-medium ${i === 0 ? 'bg-brand-50 text-brand-800' : 'text-slate-600'}`}>{t}</p>)}
      </div>
      <div className="min-w-0 flex-1 space-y-2 p-3">
        <div className="grid grid-cols-3 gap-2">
          {['Enquiries', 'Orders', 'Invoices'].map((t) => (
            <div key={t} className="rounded-lg border border-slate-200 bg-white p-2"><p className="text-[9px] font-medium text-slate-600">{t}</p><div className="mt-2">{bar('w-2/3', 'bg-brand-200')}</div></div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <svg viewBox="0 0 200 50" className="h-14 w-full" role="presentation"><polyline fill="none" stroke="#3366ff" strokeWidth="2" points="0,40 30,32 60,36 90,20 120,26 150,12 200,8" /><polyline fill="none" stroke="#f99008" strokeWidth="2" points="0,44 40,40 80,42 120,34 160,30 200,24" /></svg>
        </div>
        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
          {[0, 1, 2].map((r) => <div key={r} className="flex items-center gap-2"><i className="h-4 w-4 rounded-full bg-slate-200" />{bar('w-1/2')}<span className="ml-auto">{bar('w-8')}</span></div>)}
        </div>
      </div>
    </div>
  );
}

/** The website editor: sections on the left, the page being edited on the right. */
export function EditorScreen() {
  return (
    <div className="flex bg-slate-50">
      <div className="w-24 shrink-0 space-y-1 border-r border-slate-200 bg-white p-2">
        {['Hero', 'About', 'Services', 'Contact'].map((t, i) => <p key={t} className={`rounded-md px-2 py-1 text-[10px] font-medium ${i === 0 ? 'bg-brand-50 text-brand-800' : 'text-slate-600'}`}>{t}</p>)}
        <p className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-[10px] text-slate-500">+ Section</p>
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-4"><div className="h-2 w-2/3 rounded-full bg-white/90" /><div className="mt-2 h-1.5 w-1/2 rounded-full bg-white/60" /><div className="mt-3 h-5 w-16 rounded-md bg-gold-400" /></div>
          <div className="grid grid-cols-3 gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="space-y-1.5"><div className="h-8 rounded-md bg-slate-100" />{bar('w-full')}{bar('w-2/3')}</div>)}</div>
        </div>
      </div>
    </div>
  );
}

/** The enquiries list. */
export function EnquiriesScreen() {
  const rows: Array<[string, string, string]> = [['New', 'bg-gold-100 text-gold-800', 'w-2/3'], ['Replied', 'bg-success-100 text-success-800', 'w-1/2'], ['New', 'bg-gold-100 text-gold-800', 'w-3/4'], ['Replied', 'bg-success-100 text-success-800', 'w-2/5']];
  return (
    <div className="space-y-1.5 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold text-ink-900">Enquiries</p>
      {rows.map(([t, tone, w], i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"><i className="h-5 w-5 shrink-0 rounded-full bg-brand-100" /><div className="min-w-0 flex-1 space-y-1">{bar('w-1/3', 'bg-slate-300')}{bar(w)}</div><Label tone={tone}>{t}</Label></div>
      ))}
    </div>
  );
}

/** An invoice with a payment request button. */
export function InvoiceScreen() {
  return (
    <div className="bg-slate-50 p-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-ink-900">Invoice</p><Label>Draft</Label></div>
        <div className="mt-2 space-y-1.5">{[0, 1, 2].map((r) => <div key={r} className="flex items-center gap-2">{bar('w-1/2')}<span className="ml-auto">{bar('w-8')}</span></div>)}</div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2"><p className="text-[10px] font-semibold text-slate-700">Total</p>{bar('w-12', 'bg-ink-300')}</div>
        <p className="mt-3 rounded-md bg-brand-600 py-1.5 text-center text-[10px] font-semibold text-white">Send payment request</p>
      </div>
    </div>
  );
}

/** AI Studio: a prompt, a text draft and an image draft, with the check-and-edit step. */
export function AiScreen() {
  return (
    <div className="space-y-2 bg-slate-50 p-3">
      <div className="rounded-lg border border-slate-200 bg-white p-2"><p className="text-[9px] font-medium text-slate-600">What should it say?</p><div className="mt-1.5">{bar('w-3/4')}</div></div>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2"><Label tone="bg-gold-100 text-gold-800">Draft</Label>{bar('w-full')}{bar('w-5/6')}{bar('w-2/3')}</div>
        <div className="rounded-lg bg-gradient-to-br from-gold-200 to-brand-200" />
      </div>
      <p className="rounded-md bg-ink-900 py-1.5 text-center text-[10px] font-semibold text-white">Check and edit</p>
    </div>
  );
}

/** A directory search result on a phone. */
export function DirectoryScreen() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"><i className="h-2.5 w-2.5 rounded-full border border-slate-400" />{bar('w-1/2')}</div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 p-2">{bar('w-2/3', 'bg-slate-300')}{bar('w-1/2')}<p className="inline-block rounded-md bg-brand-600 px-2 py-0.5 text-[9px] font-semibold text-white">Visit site</p></div>
      ))}
    </div>
  );
}

/** A small illustrated site, for the industry pages: hero, a row of cards, a contact band. The tone follows the business area. */
export function SampleSite({ name, tone }: { name: string; tone: 'blue' | 'gold' | 'ink' }) {
  const hero = tone === 'blue' ? 'from-brand-600 to-brand-900' : tone === 'gold' ? 'from-gold-500 to-gold-800' : 'from-ink-700 to-ink-950';
  return (
    <BrowserFrame address={`${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.get4domain.com`}>
      <div className="bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2"><span className="text-[10px] font-bold text-ink-900">{name}</span><div className="flex gap-2">{bar('w-6')}{bar('w-6')}{bar('w-6')}</div></div>
        <div className={`bg-gradient-to-br ${hero} px-5 py-6`}><div className="h-2.5 w-3/5 rounded-full bg-white/90" /><div className="mt-2 h-1.5 w-2/5 rounded-full bg-white/60" /><div className="mt-4 flex gap-2"><div className="h-6 w-20 rounded-md bg-white" /><div className="h-6 w-16 rounded-md border border-white/60" /></div></div>
        <div className="grid grid-cols-3 gap-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="space-y-1.5 rounded-lg border border-slate-100 p-2"><div className="h-8 rounded-md bg-slate-100" />{bar('w-full')}{bar('w-2/3')}</div>)}</div>
        <div className="mx-4 mb-4 flex items-center justify-between rounded-lg bg-slate-100 p-3">{bar('w-1/3', 'bg-slate-300')}<div className="h-5 w-16 rounded-md bg-brand-600" /></div>
      </div>
    </BrowserFrame>
  );
}

/** The frame and screen for one of the six home panels. */
export function PanelPreview({ k }: { k: string }) {
  switch (k) {
    case 'dashboard': return <BrowserFrame address="app.get4domain.com"><DashboardScreen /></BrowserFrame>;
    case 'editor': return <BrowserFrame address="app.get4domain.com/website"><EditorScreen /></BrowserFrame>;
    case 'enquiries': return <PhoneFrame><EnquiriesScreen /></PhoneFrame>;
    case 'invoices': return <BrowserFrame address="app.get4domain.com/invoices"><InvoiceScreen /></BrowserFrame>;
    case 'ai': return <BrowserFrame address="app.get4domain.com/ai-studio"><AiScreen /></BrowserFrame>;
    default: return <PhoneFrame><DirectoryScreen /></PhoneFrame>;
  }
}
