import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import DirectoryEmpty from '@/components/portal/DirectoryEmpty';
import { btn } from '@/components/portal/ui';
import { directoryHomeHref } from '@/lib/v3-public/host-routing';
import { portalLinks } from '@/lib/v3-public/portal-links';
import { PORTAL } from '@/lib/v3-public/portal-strings';
import { S } from '@/lib/v3-public/strings';

/** A page with no businesses on it: said plainly, with the two things a visitor can do about it (list a business, claim a listing). No invented businesses. */
export function EmptyState() {
  const l = portalLinks('directory');
  return <DirectoryEmpty title={PORTAL.directory.emptyTitle} body={PORTAL.directory.emptyBody} registerHref={l.main('/register')} claimHref={l.claim} />;
}

/** Shown when the API cannot be reached or answers an error. The path lets the visitor reload the same address. */
export function ErrorState({ path, notConfigured = false }: { path: string; notConfigured?: boolean }) {
  return (
    <section role="alert" aria-labelledby="error-title" className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
      <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-gold-600" />
      <h1 id="error-title" className="mt-3 text-xl font-bold text-ink-900">{S.error.title}</h1>
      <p className="mt-2 text-sm text-slate-700">{notConfigured ? S.error.notConfigured : S.error.body}</p>
      <a href={path} className={`${btn('primary')} mt-4`}>{S.error.retry}</a>
    </section>
  );
}

export function GoneState() {
  return (
    <section aria-labelledby="gone-title" className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
      <h1 id="gone-title" className="text-xl font-bold text-ink-900">{S.gone.title}</h1>
      <p className="mt-2 text-sm text-slate-700">{S.gone.body}</p>
      <Link href={directoryHomeHref()} className={`${btn('secondary')} mt-4`}>{S.empty.browse}</Link>
    </section>
  );
}
