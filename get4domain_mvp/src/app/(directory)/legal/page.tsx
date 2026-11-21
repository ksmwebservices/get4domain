import type { Metadata } from 'next';
import Link from 'next/link';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { LEGAL_DOC_KEYS, LEGAL_SLUGS, S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = noindexMetadata(`${S.legal.index.title} | ${S.brand}`, S.legal.index.intro);

export default function LegalIndexPage() {
  return (
    <div className="max-w-3xl">
      <p role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{S.legal.draftBanner}</p>
      <h1 className="text-3xl font-bold text-slate-900">{S.legal.index.title}</h1>
      <p className="mt-2 text-slate-700">{S.legal.index.intro}</p>
      <ul className="mt-6 space-y-3">
        {LEGAL_DOC_KEYS.map((k) => (
          <li key={k}>
            <Link href={`/legal/${LEGAL_SLUGS[k]}`} className="font-medium text-primary-700 hover:underline">{S.legal.docs[k].title}</Link>
            <p className="text-sm text-slate-600">{S.legal.docs[k].summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
