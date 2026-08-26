import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padded?: boolean;
  /** Theme skin — default 'light' (unchanged for existing consumers). Vendor passes 'dark'. */
  skin?: 'light' | 'dark';
}

/** Minimal, premium card: 1px border, subtle shadow, rounded-2xl. */
export default function Card({ children, hover = false, padded = true, skin = 'light', className = '', ...props }: CardProps) {
  const surface = skin === 'dark'
    ? `rounded-2xl bg-ink-850/80 border border-ink-700/50 shadow-v-card backdrop-blur-sm ${hover ? 'transition-all duration-200 hover:shadow-v-card-hover hover:border-ink-600/70' : ''}`
    : `rounded-2xl bg-white border border-slate-200/80 shadow-card ${hover ? 'transition-all duration-300 hover:shadow-card-hover hover:border-primary-200' : ''}`;
  return (
    <div className={`${surface} ${padded ? 'p-5' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}
