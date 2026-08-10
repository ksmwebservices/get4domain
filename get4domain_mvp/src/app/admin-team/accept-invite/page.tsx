'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

function AcceptInviteForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-600/30';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) { setError('Missing invite token. Use the link from your invite email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await api.acceptAdminInvite({ inviteToken: token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept invite');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success-400" />
        <h1 className="text-lg font-bold text-white">You&apos;re all set</h1>
        <p className="mt-2 text-sm text-slate-400">Your password has been set. You can now sign in to the Get4Domain Admin Platform.</p>
        <Link href="/login" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500">Go to Login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <div className="text-center">
        <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary-400" />
        <h1 className="text-lg font-bold text-white">Accept your invite</h1>
        <p className="mt-1 text-sm text-slate-400">Set a password to join the Get4Domain team.</p>
      </div>
      {error && <div className="rounded-xl border border-error-500/40 bg-error-500/10 px-4 py-3 text-sm text-error-300">{error}</div>}
      <input type="password" required placeholder="New password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      <input type="password" required placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-60">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}Set Password
      </button>
    </form>
  );
}

export default function AdminAcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-slate-500" />}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
