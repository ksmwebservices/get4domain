import type { Metadata } from 'next';
import Crumbs from '@/components/site/Crumbs';
import { siteConfig } from '@/constants/site';
import { assertV3Public } from '@/lib/v3-public/guard';
import { siteMetadata } from '@/lib/v3-public/site-metadata';
import { SITE } from '@/lib/v3-public/site-strings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  assertV3Public();
  return siteMetadata({ title: SITE.contact.metaTitle, description: SITE.contact.metaDescription, path: '/contact' });
}

/** Get4Domain's own contact page. The one address is the support email already published by the live site (constants/site.ts); no phone or WhatsApp number is published. */
export default function ContactPage() {
  assertV3Public();
  const C = SITE.contact;
  const email = siteConfig.contact.support;
  return (
    <>
      <Crumbs here={C.h1} path="/contact" />
      <h1 className="text-3xl font-bold text-slate-900">{C.h1}</h1>
      <p className="mt-4 max-w-2xl text-slate-700">{C.body}</p>
      <p className="mt-4 text-slate-900"><span className="font-medium">{C.emailLabel}:</span> <a href={`mailto:${email}`} className="underline">{email}</a></p>
    </>
  );
}
