'use client';

import Link from 'next/link';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useV2 } from '@/dashboard-v2/context';

const rupees = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Shown in the header of every page while a plan invoice is unpaid. The only place the vendor pays us is Plan and billing, so it always links there. */
export default function PaymentDueBanner() {
  const v2 = useV2();
  const due = v2?.ctx?.paymentDue;
  if (!due) return null;
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2 text-sm lg:px-8 ${due.overdue ? 'bg-error-50 text-error-800' : 'bg-amber-50 text-amber-900'}`}>
      <span className="flex items-center gap-2">
        {due.overdue ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <CreditCard className="h-4 w-4 flex-shrink-0" />}
        <span><strong>{rupees(due.totalPaise)}</strong> {due.overdue ? 'was due' : 'is due'}{due.dueDate ? ` on ${fmt(due.dueDate)}` : ''} for your plan ({due.invoiceNumber}).</span>
      </span>
      <Link href="/dashboard/account/billing?tab=billing" className="rounded-lg bg-white/80 px-3 py-1 text-xs font-semibold underline">Pay now</Link>
    </div>
  );
}
