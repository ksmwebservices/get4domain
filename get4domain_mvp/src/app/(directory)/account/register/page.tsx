import type { Metadata } from 'next';
import { RegisterForm } from '@/components/directory/AuthForms';
import { INDUSTRIES } from '@/data/industries-list';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { ...noindexMetadata(`${S.auth.register.title} | ${S.brand}`, S.auth.register.intro), referrer: 'no-referrer' };

export default function AccountRegisterPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-slate-900">{S.auth.register.title}</h1>
      <p className="mt-3 text-slate-700">{S.auth.register.intro}</p>
      <div className="mt-6"><RegisterForm vendorUrl={vendorAppUrl()} industries={INDUSTRIES.map((i) => ({ id: i.id, name: i.name }))} /></div>
    </div>
  );
}
