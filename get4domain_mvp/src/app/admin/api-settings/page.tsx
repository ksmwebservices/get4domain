'use client';

import { useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';

const KEYS = [
  { label: 'Razorpay Key ID', masked: 'rzp_live_*****' },
  { label: 'Razorpay Key Secret', masked: '*******' },
  { label: 'Claude API Key', masked: 'sk-ant-*****' },
  { label: 'OpenAI API Key', masked: 'sk-*****' },
  { label: 'Resend API Key', masked: 're_*****' },
  { label: 'VAPID Public Key (Web Push)', masked: 'BFVYM*****' },
];

export default function ApiSettingsPage() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">API Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Reference only — real keys live on the server.</p>
      </div>

      <div className="rounded-xl border border-primary-800 bg-primary-950/40 px-4 py-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-primary-300">
          These values are shown masked for reference only. To rotate a key, update it in{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-primary-200">/srv/get4domain-site/backend-api/.env.local</code>{' '}
          on the server and rebuild Docker to apply the change.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
        {KEYS.map((key) => (
          <div key={key.label} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-white">{key.label}</div>
              <div className="text-xs font-mono text-slate-500 mt-0.5">
                {revealed[key.label] ? key.masked : key.masked.replace(/\*+/g, '••••••••')}
              </div>
            </div>
            <button
              onClick={() => setRevealed((prev) => ({ ...prev, [key.label]: !prev[key.label] }))}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Toggle visibility"
            >
              {revealed[key.label] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
