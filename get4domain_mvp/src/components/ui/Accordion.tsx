'use client';

import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionItem({ question, answer, isOpen, onToggle }: AccordionItemProps) {
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-primary-600"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-slate-900">{question}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100 pb-5' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-slate-600">{answer}</p>
        </div>
      </div>
    </div>
  );
}

interface AccordionProps {
  items: { id: string; question: string; answer: string }[];
}

export default function Accordion({ items }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y divide-slate-200">
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          question={item.question}
          answer={item.answer}
          isOpen={openId === item.id}
          onToggle={() => setOpenId(openId === item.id ? null : item.id)}
        />
      ))}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'primary', size = 'md' }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    secondary: 'bg-secondary-50 text-secondary-700 border-secondary-200',
    success: 'bg-success-50 text-success-700 border-success-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    error: 'bg-error-50 text-error-700 border-error-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
}

export function SectionHeading({ eyebrow, title, description, center = true }: SectionHeadingProps) {
  return (
    <div className={`${center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} mb-12`}>
      {eyebrow && (
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wider text-primary-600">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl text-balance">{title}</h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-slate-600 text-balance">{description}</p>
      )}
    </div>
  );
}
