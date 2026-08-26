'use client';

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  /** Theme skin — default 'light' (unchanged for existing consumers). Vendor passes 'dark'. */
  skin?: 'light' | 'dark';
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-4xl', skin = 'light' }: ModalProps) {
  const dark = skin === 'dark';
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`absolute inset-0 backdrop-blur-sm ${dark ? 'bg-ink-950/80' : 'bg-slate-900/60'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Mobile: bottom sheet (flush, rounded top). sm+: centered modal. */}
      <div
        className={`relative w-full ${maxWidth} max-h-[88vh] overflow-y-auto rounded-t-2xl shadow-2xl animate-scale-in sm:rounded-2xl ${dark ? 'bg-ink-850 border border-ink-700/50' : 'bg-white'}`}
      >
        <div className={`mx-auto mt-2 h-1.5 w-10 rounded-full sm:hidden ${dark ? 'bg-ink-700' : 'bg-slate-200'}`} />
        {title && (
          <div className={`sticky top-0 z-10 flex items-center justify-between border-b backdrop-blur px-6 py-4 ${dark ? 'border-ink-700/50 bg-ink-900/95' : 'border-slate-100 bg-white/95'}`}>
            <h3 className={`text-xl font-bold ${dark ? 'text-ink-50' : 'text-slate-900'}`}>{title}</h3>
            <button
              onClick={onClose}
              className={`rounded-lg p-2 transition-colors ${dark ? 'text-ink-400 hover:bg-ink-800 hover:text-ink-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className={`absolute right-4 top-4 z-10 rounded-lg p-2 shadow-sm transition-colors ${dark ? 'bg-ink-800/90 text-ink-400 hover:bg-ink-700 hover:text-ink-100' : 'bg-white/90 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
