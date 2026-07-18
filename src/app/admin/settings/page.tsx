'use client';

import { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Admin Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Platform configuration and contact details.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Contact Details</h3>
          <div className="grid gap-4">
            {[
              { label: 'Support Phone', defaultValue: '+91 98765 43210', type: 'tel' },
              { label: 'Support Email', defaultValue: 'support@get4domain.in', type: 'email' },
              { label: 'WhatsApp Number', defaultValue: '+91 98765 43210', type: 'tel' },
              { label: 'Office Address', defaultValue: 'Chennai, Tamil Nadu, India', type: 'text' },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1.5 block text-sm font-medium text-slate-400">{field.label}</label>
                <input type={field.type} defaultValue={field.defaultValue}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Demo Booking Settings</h3>
          <div className="grid gap-4">
            {[
              { label: 'Response Commitment', defaultValue: 'Our consultant will call within 24 hours', type: 'text' },
              { label: 'Consultant Name', defaultValue: 'Get4Domain Team', type: 'text' },
            ].map((field) => (
              <div key={field.label}>
                <label className="mb-1.5 block text-sm font-medium text-slate-400">{field.label}</label>
                <input type={field.type} defaultValue={field.defaultValue}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" leftIcon={<Save className="h-4 w-4" />} className="bg-primary-600 hover:bg-primary-700 text-white">
            Save Changes
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-success-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
