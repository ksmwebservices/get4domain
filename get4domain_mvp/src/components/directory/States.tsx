import Link from 'next/link';
import { directoryHomeHref } from '@/lib/v3-public/host-routing';
import { S } from '@/lib/v3-public/strings';

export function EmptyState() {
  return (
    <section aria-labelledby="empty-title" className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
      <h2 id="empty-title" className="text-lg font-semibold text-slate-900">{S.empty.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{S.empty.body}</p>
      <Link href={directoryHomeHref()} className="mt-4 inline-block text-sm font-medium text-primary-700 hover:underline">{S.empty.browse}</Link>
    </section>
  );
}

/** Shown when the API cannot be reached or answers an error. The path lets the visitor reload the same address. */
export function ErrorState({ path, notConfigured = false }: { path: string; notConfigured?: boolean }) {
  return (
    <section role="alert" aria-labelledby="error-title" className="rounded-xl border border-slate-300 bg-slate-50 p-8 text-center">
      <h1 id="error-title" className="text-xl font-semibold text-slate-900">{S.error.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{notConfigured ? S.error.notConfigured : S.error.body}</p>
      <a href={path} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{S.error.retry}</a>
    </section>
  );
}

export function GoneState() {
  return (
    <section aria-labelledby="gone-title" className="rounded-xl border border-slate-300 bg-slate-50 p-8 text-center">
      <h1 id="gone-title" className="text-xl font-semibold text-slate-900">{S.gone.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{S.gone.body}</p>
      <Link href={directoryHomeHref()} className="mt-4 inline-block text-sm font-medium text-primary-700 hover:underline">{S.empty.browse}</Link>
    </section>
  );
}
