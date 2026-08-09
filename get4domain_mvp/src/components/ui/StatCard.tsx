import { type ReactNode } from 'react';
import Card from './Card';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
}

const iconTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  error: 'bg-error-50 text-error-600',
  neutral: 'bg-slate-100 text-slate-600',
};

/** Dashboard KPI tile: label, big value, optional icon + hint. */
export default function StatCard({ label, value, icon, hint, tone = 'primary' }: StatCardProps) {
  return (
    <Card className="flex items-start justify-between">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1.5 text-2xl font-bold text-slate-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
      </div>
      {icon && (
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}>
          {icon}
        </div>
      )}
    </Card>
  );
}
