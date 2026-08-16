'use client';

import { useEffect, useState } from 'react';
import { Loader2, Copy, CheckCircle2, Code, MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';

// 3B — vendor gets their embeddable widget snippet + lead API to use on their OWN site.
export default function EmbedPage() {
  const [data, setData] = useState<{ widgetKey: string; snippet: string; leadApi: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string>('');

  useEffect(() => {
    api.getWidgetKey().then((r) => setData(r.data ?? null)).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load')).finally(() => setLoading(false));
  }, []);

  const copy = (text: string, which: string) => { navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(''), 1500); };

  const curl = data ? `curl -X POST ${data.leadApi} \\
  -H "Content-Type: application/json" \\
  -d '{"key":"${data.widgetKey}","name":"Jane","phone":"9876543210","message":"Interested"}'` : '';

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (error || !data) return <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{error || 'Could not load your widget key.'}</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Embed on your own website</h2>
        <p className="mt-1 text-sm text-slate-500">Add a chat + enquiry widget to any site you already have. Leads flow straight into your CRM/TeleCRM.</p>
      </div>

      {/* Widget snippet */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><MessageCircle className="h-4 w-4 text-primary-600" /> Chat + enquiry widget</div>
        <p className="mb-3 text-sm text-slate-500">Paste this once, just before <code className="rounded bg-slate-100 px-1">&lt;/body&gt;</code>. A chat bubble appears bottom-right.</p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{data.snippet}</pre>
          <button onClick={() => copy(data.snippet, 'snippet')} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20">
            {copied === 'snippet' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === 'snippet' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Lead API */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><Code className="h-4 w-4 text-primary-600" /> Lead API (for developers)</div>
        <p className="mb-3 text-sm text-slate-500">Prefer your own form? POST a lead directly — it lands in the same pipeline.</p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{curl}</pre>
          <button onClick={() => copy(curl, 'curl')} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20">
            {copied === 'curl' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === 'curl' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Your public widget key: <code className="rounded bg-slate-100 px-1">{data.widgetKey}</code> — it only allows submitting leads/chat to your account, never reading data.</p>
      </div>
    </div>
  );
}
