'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Save, CheckCircle2, QrCode, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { canSeeCommerce } from '@/lib/admin-nav';

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  const showCommerce = canSeeCommerce(user?.adminRole ?? 'SUPER_ADMIN');

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

      {/* Commercial Engine v1: where payers are told to send money (UPI ID, QR, bank details). Hidden from MARKETING staff. */}
      {showCommerce && (
        <Link href="/admin/commerce/payee" className="flex items-center justify-between gap-3 rounded-2xl border border-primary-500/30 bg-primary-500/10 p-4 hover:bg-primary-500/15">
          <span className="flex items-center gap-3">
            <QrCode className="h-5 w-5 text-primary-300" />
            <span><span className="block text-sm font-bold text-white">Payee &amp; QR</span><span className="block text-xs text-slate-400">UPI ID, payee name, static QR, bank details and payment instructions shown on pay links.</span></span>
          </span>
          <ArrowRight className="h-4 w-4 text-primary-300" />
        </Link>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Contact Details</h3>
          <div className="grid gap-4">
            {[
              { label: 'Support Phone', defaultValue: '+91 98765 43210', type: 'tel' },
              { label: 'Support Email', defaultValue: 'support@get4domain.com', type: 'email' },
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
