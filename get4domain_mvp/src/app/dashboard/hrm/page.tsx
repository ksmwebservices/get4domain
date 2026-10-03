'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/vendor/EmptyState';

/**
 * HRM (staff, attendance, payroll). The workspace itself is still being finished, so a vendor
 * who opens it gets a calm, on-brand holding state instead of an empty screen or a 404.
 * This is an in-product courtesy for paying vendors — not marketing copy.
 */
export default function HrmPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink-50">HRM</h1>
      <p className="mt-1 text-sm text-ink-400">Staff records, attendance and payroll.</p>
      <div className="mt-6 rounded-2xl border border-ink-700/50 bg-ink-900/40">
        <EmptyState
          icon="UserCog"
          title="Setting up your account — available shortly"
          description="Your HRM workspace is being prepared and will appear here as soon as it is ready. Nothing you need to do."
          action={
            <Link href="/dashboard/support" className="inline-flex items-center justify-center rounded-lg border border-ink-600 px-4 py-2 text-sm font-medium text-ink-200 hover:bg-ink-800">
              Need it sooner? Contact support
            </Link>
          }
        />
      </div>
    </div>
  );
}
