'use client';

import { useState } from 'react';
import { User, Mail, Phone, Building2, Save } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000); }, 1000);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Account Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Update your profile and business information.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Profile</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input defaultValue="Muthukumar R" type="text" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input defaultValue="info@mrtravels.com" type="email" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input defaultValue="+91 98765 43210" type="tel" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input defaultValue="MR Travels" type="text" className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Change Password</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
              <input type="password" placeholder="Enter new password" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input type="password" placeholder="Confirm new password" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Save Changes
          </Button>
          {saved && <span className="text-sm text-success-600 font-medium">✓ Saved successfully</span>}
        </div>
      </form>
    </div>
  );
}
