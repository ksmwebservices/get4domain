import type { Metadata } from 'next';
import { LoginForm } from '@/components/directory/AuthForms';
import { vendorAppUrl } from '@/lib/v3-public/config';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { ...noindexMetadata(`${S.auth.login.title} | ${S.brand}`, S.auth.login.intro), referrer: 'no-referrer' };

export default function AccountLoginPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-slate-900">{S.auth.login.title}</h1>
      <p className="mt-3 text-slate-700">{S.auth.login.intro}</p>
      <div className="mt-6"><LoginForm vendorUrl={vendorAppUrl()} /></div>
    </div>
  );
}
