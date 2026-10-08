'use client';

import Link from 'next/link';
import { User, Mail, Building2, Globe, LifeBuoy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * Account details. These are the vendor's real details as stored on the platform. Changing them (or the password) is done by the
 * Get4Domain team through Support so it is verified — this page does not pretend to save anything.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const rows: { icon: typeof User; label: string; value: string | undefined | null }[] = [
    { icon: User, label: 'Full name', value: user?.name },
    { icon: Mail, label: 'Email address', value: user?.email },
    { icon: Building2, label: 'Business name', value: user?.businessName },
    { icon: Globe, label: 'Industry', value: user?.industry },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Account Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Your account details on Get4Domain.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-700">Profile</h3>
        <dl className="space-y-4">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="break-words text-sm font-medium text-slate-900">{value || '—'}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50 p-5 text-sm text-slate-700">
        <LifeBuoy className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
        <p>
          To change your name, email, phone or password, raise a request in{' '}
          <Link href="/dashboard/support" className="font-semibold text-primary-700 underline">Support</Link>. We confirm it with you before we change it.
        </p>
      </div>
    </div>
  );
}
