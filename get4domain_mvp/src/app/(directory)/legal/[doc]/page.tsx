import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDoc from '@/components/directory/LegalDoc';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { LEGAL_DOC_KEYS, LEGAL_SLUGS, S, type LegalDocKey } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ doc: string }> };

const keyOf = (slug: string): LegalDocKey | null => LEGAL_DOC_KEYS.find((k) => LEGAL_SLUGS[k] === slug) ?? null;

// Drafts: not indexable until counsel has approved the texts.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = keyOf((await params).doc);
  if (!key) notFound();
  return noindexMetadata(`${S.legal.docs[key].title} | ${S.brand}`, S.legal.docs[key].summary);
}

export default async function LegalPage({ params }: Props) {
  const key = keyOf((await params).doc);
  if (!key) notFound();
  return <LegalDoc docKey={key} />;
}
