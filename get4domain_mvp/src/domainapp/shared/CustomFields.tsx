'use client';

import { Input, Textarea, Select } from '@/components/ui/Input';
import { type CustomField } from '@/lib/dashboard-config';

interface CustomFieldsProps {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/** Renders create/edit inputs for an industry's custom fields. */
export function CustomFieldInputs({ fields, values, onChange }: CustomFieldsProps) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((f) => {
        const value = (values[f.key] ?? '') as string;
        if (f.type === 'textarea') {
          return (
            <Textarea key={f.key} label={f.label} required={f.required} value={value}
              onChange={(e) => onChange(f.key, e.target.value)} />
          );
        }
        if (f.type === 'select') {
          return (
            <Select key={f.key} label={f.label} required={f.required} value={value}
              onChange={(e) => onChange(f.key, e.target.value)}>
              <option value="">Select…</option>
              {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </Select>
          );
        }
        return (
          <Input key={f.key} label={f.label} required={f.required}
            type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
            value={value} onChange={(e) => onChange(f.key, e.target.value)} />
        );
      })}
    </>
  );
}

/** Read-only display of custom field key/values in a detail drawer. */
export function CustomFieldDisplay({ fields, values }: { fields: CustomField[]; values: Record<string, unknown> }) {
  const present = fields.filter((f) => values?.[f.key] !== undefined && values?.[f.key] !== '');
  if (present.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-3">
      {present.map((f) => (
        <div key={f.key}>
          <dt className="text-xs text-slate-400">{f.label}</dt>
          <dd className="text-sm font-medium text-slate-800">{String(values[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}
