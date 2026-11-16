import Link from 'next/link';
import { S } from '@/lib/v3-public/strings';
import type { ListingState } from '@/lib/v3-public/types';

/** One clear, plain screen of the claim flow. Presentational only: no data, no secrets. */
export function Notice({ title, children, tone = 'neutral', role }: { title: string; children?: React.ReactNode; tone?: 'neutral' | 'warn' | 'good'; role?: 'alert' | 'status' }) {
  const color = tone === 'warn' ? 'border-amber-300 bg-amber-50' : tone === 'good' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50';
  return (
    <section role={role} className={`rounded-xl border p-6 ${color}`}>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children && <div className="mt-2 text-sm text-slate-700">{children}</div>}
    </section>
  );
}

const STATE_TEXT: Record<ListingState, { title: string; body: string }> = {
  UNCLAIMED_LISTING: S.claim.states.unclaimed,
  DRAFT_SITE: S.claim.states.draft,
  CLAIMED: S.claim.states.claimed,
  LIVE: S.claim.states.live,
};

/** The screen for each of the four listing states. */
export function ListingStateScreen({ state }: { state: ListingState }) {
  const t = STATE_TEXT[state];
  return <Notice title={t.title} tone={state === 'UNCLAIMED_LISTING' ? 'good' : 'neutral'}><p>{t.body}</p></Notice>;
}

export function InvalidLinkScreen() {
  return (
    <Notice title={S.claim.link.invalidTitle} tone="warn" role="alert">
      <p>{S.claim.link.invalidBody}</p>
      <p className="mt-3"><Link href="/claim" className="font-medium text-primary-700 hover:underline">{S.claim.link.start}</Link></p>
    </Notice>
  );
}

export function MailOffScreen() {
  return <Notice title={S.claim.request.mailOffTitle} tone="warn" role="status"><p>{S.claim.request.mailOff}</p></Notice>;
}

export function StartUnavailableScreen() {
  return <Notice title={S.claim.start.title} tone="warn" role="status"><p>{S.claim.startUnavailable}</p></Notice>;
}

export function ApprovalScreen({ vendorUrl }: { vendorUrl: string | null }) {
  return (
    <Notice title={S.claim.approval.title} tone="good" role="status">
      <p>{S.claim.approval.body}</p>
      <p className="mt-3">
        {vendorUrl ? (
          <a href={vendorUrl} rel="noopener" className="inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">{S.claim.approval.cta}</a>
        ) : (
          <span className="text-slate-500">{S.claim.approval.notAvailable}</span>
        )}
      </p>
    </Notice>
  );
}

export function LiveScreen({ vendorUrl }: { vendorUrl: string | null }) {
  return (
    <Notice title={S.claim.live.title} tone="good" role="status">
      <p>{S.claim.live.body}</p>
      <p className="mt-3">
        {vendorUrl ? (
          <a href={vendorUrl} rel="noopener" className="inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">{S.claim.live.cta}</a>
        ) : (
          <span className="text-slate-500">{S.claim.approval.notAvailable}</span>
        )}
      </p>
    </Notice>
  );
}
