import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Theme skin — default 'light' keeps the exact existing field styling for all
// current consumers; the vendor dashboard passes skin="dark".
type Skin = 'light' | 'dark';
const fieldBaseFor = (skin: Skin) =>
  skin === 'dark'
    ? 'w-full rounded-xl border border-ink-700/60 bg-ink-900/60 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-800/50 disabled:text-ink-500'
    : 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400';
const errBorder = (skin: Skin) => (skin === 'dark' ? 'border-ruby-500/60' : 'border-error-300');
const errText = (skin: Skin) => (skin === 'dark' ? 'text-ruby-400' : 'text-error-600');

interface FieldWrapProps {
  label?: string;
  error?: string;
  required?: boolean;
  skin?: Skin;
}

function Label({ label, required, skin = 'light' }: { label?: string; required?: boolean; skin?: Skin }) {
  if (!label) return null;
  return (
    <label className={`mb-1.5 block text-sm font-medium ${skin === 'dark' ? 'text-ink-300' : 'text-slate-700'}`}>
      {label}
      {required && <span className="ml-0.5 text-error-500">*</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapProps>(
  ({ label, error, required, skin = 'light', className = '', ...props }, ref) => (
    <div>
      <Label label={label} required={required} skin={skin} />
      <input ref={ref} className={`${fieldBaseFor(skin)} ${error ? errBorder(skin) : ''} ${className}`} {...props} />
      {error && <p className={`mt-1 text-xs ${errText(skin)}`}>{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapProps>(
  ({ label, error, required, skin = 'light', className = '', ...props }, ref) => (
    <div>
      <Label label={label} required={required} skin={skin} />
      <textarea ref={ref} className={`${fieldBaseFor(skin)} min-h-[90px] ${error ? errBorder(skin) : ''} ${className}`} {...props} />
      {error && <p className={`mt-1 text-xs ${errText(skin)}`}>{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrapProps>(
  ({ label, error, required, skin = 'light', className = '', children, ...props }, ref) => (
    <div>
      <Label label={label} required={required} skin={skin} />
      <select ref={ref} className={`${fieldBaseFor(skin)} ${error ? errBorder(skin) : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p className={`mt-1 text-xs ${errText(skin)}`}>{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

export default Input;
