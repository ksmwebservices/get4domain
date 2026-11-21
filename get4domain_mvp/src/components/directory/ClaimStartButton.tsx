'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StartUnavailableScreen } from '@/components/directory/ClaimScreens';
import { messageForCode, S } from '@/lib/v3-public/strings';
import type { ClaimCallResult } from '@/lib/v3-public/types';

/** Starts a claim for an unclaimed listing and moves to the claim link page. If the API has no start route yet (gap G1) the visitor sees "not available yet", never an error page. */
export default function ClaimStartButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  async function start(): Promise<void> {
    setBusy(true); setError(null);
    let r: ClaimCallResult;
    try {
      const res = await fetch('/directory-api/claim/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug }), cache: 'no-store' });
      r = res.ok ? ((await res.json()) as ClaimCallResult) : { ok: false, status: res.status, code: null, message: null, data: null };
    } catch {
      r = { ok: false, status: 0, code: null, message: null, data: null };
    }
    const token = (r.data as { token?: string } | null)?.token;
    if (r.ok && token) { router.push(`/claim/${encodeURIComponent(token)}`); return; }
    setBusy(false);
    if (r.status === 0) { setError(S.errors.network); return; }
    if (r.status === 429) { setError(r.message || S.errors.rateLimited); return; }
    if (!r.code && (r.status === 404 || r.status === 405 || r.status === 501)) { setUnavailable(true); return; }
    setError(messageForCode(r.code, r.status));
  }

  if (unavailable) return <StartUnavailableScreen />;
  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>}
      <button type="button" onClick={start} disabled={busy} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? S.claim.start.working : S.claim.start.cta}
      </button>
    </div>
  );
}
