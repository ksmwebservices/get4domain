import { type ReactNode } from 'react';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  error: 'bg-error-50 text-error-700',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Explicit hex dot + tint, used for industry record statuses. */
  color?: string;
  className?: string;
}

/** Status pill. Pass `tone` for semantic colors or `color` for a hex dot. */
export default function Badge({ children, tone = 'neutral', color, className = '' }: BadgeProps) {
  if (color) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
        style={{ backgroundColor: `${color}1a`, color }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {children}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
