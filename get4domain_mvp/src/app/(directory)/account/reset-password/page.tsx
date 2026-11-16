import type { Metadata } from 'next';
import { ResetForm } from '@/components/directory/AuthForms';
import { noindexMetadata } from '@/lib/v3-public/metadata';
import { S } from '@/lib/v3-public/strings';

export const dynamic = 'force-dynamic';

// The reset token is in the address, so it must never travel in a Referer header and the page must never be indexed.
export const metadata: Metadata = { ...noindexMetadata(`${S.auth.reset.title} | ${S.brand}`, S.auth.reset.intro), referrer: 'no-referrer' };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** The page the reset email links to: /account/reset-password?token=... */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const value = typeof token === 'string' && token.length > 0 && token.length <= 512 ? token : null;
  return (
    <div className="max-w-md">
      <h1 className="text-3xl font-bold text-slate-900">{S.auth.reset.title}</h1>
      <p className="mt-3 text-slate-700">{S.auth.reset.intro}</p>
      <div className="mt-6"><ResetForm token={value} /></div>
    </div>
  );
}
