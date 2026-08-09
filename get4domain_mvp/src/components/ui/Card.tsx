import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padded?: boolean;
}

/** Minimal, premium card: 1px border, subtle shadow, rounded-2xl. */
export default function Card({ children, hover = false, padded = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/80 shadow-card ${padded ? 'p-5' : ''} ${
        hover ? 'transition-all duration-300 hover:shadow-card-hover hover:border-primary-200' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
