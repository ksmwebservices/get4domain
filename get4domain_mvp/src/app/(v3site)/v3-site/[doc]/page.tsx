import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalDocument from '@/components/site/LegalDocument';
import { getFirmFacts } from '@/lib/v3-public/firm-facts';
import { assertV3Public } from '@/lib/v3-public/guard';
import { legalDocByPath } from '@/lib/v3-public/legal-docs';
import { siteMetadata } from '@/lib/v3-public/site-metadata';

export const dynamic = 'force-dynamic';

/** Every policy page (terms, privacy, refunds, payments, delivery, acceptable use, cookies, disclaimer, partner and listing terms). Reached only by the main-host rewrite; flag off is a 404. */
export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  assertV3Public();
  const doc = legalDocByPath(`/${(await params).doc}`);
  if (!doc) notFound();
  return siteMetadata({ title: doc.metaTitle, description: doc.metaDescription, path: doc.path });
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  assertV3Public();
  const doc = legalDocByPath(`/${(await params).doc}`);
  if (!doc) notFound();
  return <LegalDocument doc={doc} facts={await getFirmFacts()} />;
}
