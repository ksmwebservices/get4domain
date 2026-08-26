interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold';
  size?: 'sm' | 'xs';
  dot?: boolean;
  className?: string;
}

const variants: Record<string, string> = {
  default: 'bg-ink-700/60 text-ink-200 border-ink-600/40',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
  error: 'bg-ruby-500/15 text-ruby-400 border-ruby-500/30',
  info: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  gold: 'bg-gold-500/15 text-gold-300 border-gold-500/30',
};

const dotColors: Record<string, string> = {
  default: 'bg-ink-300', success: 'bg-success', warning: 'bg-gold-400',
  error: 'bg-ruby-400', info: 'bg-brand-400', gold: 'bg-gold-400',
};

export function Badge({ children, variant = 'default', size = 'sm', dot, className = '' }: BadgeProps) {
  const sizing = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`chip border ${variants[variant]} ${sizing} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} animate-pulse`} />}
      {children}
    </span>
  );
}

export default Badge;
