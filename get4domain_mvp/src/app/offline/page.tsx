import { WifiOff } from 'lucide-react';

export const metadata = { title: "You're offline — Get4Domain" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card">
        <WifiOff className="h-8 w-8 text-slate-400" />
      </div>
      <h1 className="text-lg font-bold text-slate-900">You&apos;re offline</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Check your connection and try again. Your Get4Domain dashboard will reconnect automatically.
      </p>
      <a href="/dashboard" className="mt-5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
        Retry
      </a>
    </div>
  );
}
