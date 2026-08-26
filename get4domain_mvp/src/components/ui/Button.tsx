import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  /** Theme skin — default 'light' (unchanged for all existing consumers).
   * The vendor dashboard passes 'dark'. */
  skin?: 'light' | 'dark';
}

export default function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth = false,
  loading = false,
  skin = 'light',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    `inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      skin === 'dark' ? 'focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950' : 'focus-visible:ring-primary-400 focus-visible:ring-offset-2'
    }`;

  const variants = skin === 'dark'
    ? {
        primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-glow-brand',
        outline: 'border-2 border-ink-700 text-ink-200 hover:border-brand-500/50 hover:text-brand-300 hover:bg-brand-500/10 bg-ink-900/40',
        ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
      }
    : {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm hover:shadow-md',
        outline: 'border-2 border-slate-200 text-slate-700 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 bg-white',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      };

  const sizes = {
    sm: 'px-3.5 py-2 text-xs',
    md: 'px-4.5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
