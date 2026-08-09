import { Lock } from 'lucide-react';

/** Small lock chip shown on plan/addon-gated sidebar tabs. */
export default function LockedBadge({ className = '' }: { className?: string }) {
  return <Lock className={`h-3.5 w-3.5 text-slate-400 ${className}`} aria-label="Locked feature" />;
}
