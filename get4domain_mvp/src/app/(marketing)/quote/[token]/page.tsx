'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const [html, setHtml] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState<'accepted' | 'declined' | null>(null);

  function load() {
    setLoading(true);
    api.getPublicProposal(params.token)
      .then((res) => { setHtml(res.data?.html ?? ''); setStatus(res.data?.status ?? ''); })
      .catch(() => setError('This proposal link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [params.token]);

  async function respond(next: 'accepted' | 'declined') {
    setResponding(next);
    try {
      await api.respondPublicProposal(params.token, next);
      setStatus(next);
    } catch {
      setError('Could not record your response — please try again.');
    } finally {
      setResponding(null);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-center text-sm text-slate-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div dangerouslySetInnerHTML={{ __html: html }} />

        {status === 'accepted' ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-success-50 px-5 py-4 text-sm font-semibold text-success-700">
            <CheckCircle2 className="h-5 w-5" />You&apos;ve accepted this proposal. We&apos;ll be in touch shortly.
          </div>
        ) : status === 'declined' ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-4 text-sm font-semibold text-slate-600">
            <XCircle className="h-5 w-5" />You&apos;ve declined this proposal.
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => respond('accepted')} disabled={responding !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success-600 px-6 py-3 text-sm font-semibold text-white hover:bg-success-500 disabled:opacity-60 sm:w-auto">
              {responding === 'accepted' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}Accept Proposal
            </button>
            <button onClick={() => respond('declined')} disabled={responding !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 sm:w-auto">
              {responding === 'declined' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
