import type { Metadata } from 'next';
import { ForgotForm } from '@/components/directory/AuthForms';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { ...noindexMetadata(`${S.auth.forgot.title} | ${S.brand}`, S.auth.forgot.intro), referrer: 'no-referrer' };

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-slate-900">{S.auth.forgot.title}</h1>
      <p className="mt-3 text-slate-700">{S.auth.forgot.intro}</p>
      <div className="mt-6"><ForgotForm /></div>
    </div>
  );
}
