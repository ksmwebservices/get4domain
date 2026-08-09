import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const fieldBase =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400';

interface FieldWrapProps {
  label?: string;
  error?: string;
  required?: boolean;
}

function Label({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null;
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="ml-0.5 text-error-500">*</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapProps>(
  ({ label, error, required, className = '', ...props }, ref) => (
    <div>
      <Label label={label} required={required} />
      <input ref={ref} className={`${fieldBase} ${error ? 'border-error-300' : ''} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-error-600">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapProps>(
  ({ label, error, required, className = '', ...props }, ref) => (
    <div>
      <Label label={label} required={required} />
      <textarea ref={ref} className={`${fieldBase} min-h-[90px] ${error ? 'border-error-300' : ''} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-error-600">{error}</p>}
    </div>
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrapProps>(
  ({ label, error, required, className = '', children, ...props }, ref) => (
    <div>
      <Label label={label} required={required} />
      <select ref={ref} className={`${fieldBase} ${error ? 'border-error-300' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-error-600">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

export default Input;
