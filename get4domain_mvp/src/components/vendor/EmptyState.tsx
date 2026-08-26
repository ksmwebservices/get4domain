import { Icon } from './Icon';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Real empty state — shown when a real data fetch returns nothing (not decorative).
 * `action` is typically a button that starts the relevant create flow.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-ink-800/60 border border-ink-700/50 flex items-center justify-center mb-4">
        <Icon name={icon} className="w-7 h-7 text-ink-500" />
      </div>
      <h3 className="text-base font-semibold text-ink-200">{title}</h3>
      {description && <p className="text-sm text-ink-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
