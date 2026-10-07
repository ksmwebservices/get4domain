'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import PayPanel from '@/components/vendor/PayPanel';
import { publicPayApi } from '@/lib/commerce';

/** Public pay page — no login. The token in the URL is the only credential (256-bit, hashed at rest, expiring). */
export default function PayPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const api = useMemo(() => publicPayApi(token), [token]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-6 sm:py-10">
      <header className="mb-5 flex items-center justify-between">
        <img src="/logo.png" alt="Get4Domain" className="h-12 w-auto object-contain" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"><Lock className="h-3.5 w-3.5" />Secure payment</span>
      </header>
      <main className="flex-1"><PayPanel api={api} /></main>
      <footer className="mt-8 space-y-1 pb-4 text-center text-xs text-slate-500">
        <p className="flex items-center justify-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Payments are confirmed by Get4Domain before your invoice is marked paid.</p>
        <p>KSM Quantum Technologies · Tidel Park, Chennai · support@get4domain.com</p>
      </footer>
    </div>
  );
}
