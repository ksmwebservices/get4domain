'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Mail, Phone, CheckCircle2, Ban, Plus, Loader2, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';

const INDUSTRIES = [
  'restaurant', 'travel', 'healthcare', 'education', 'realestate', 'retail', 'beauty', 'fitness',
  'construction', 'professional', 'events', 'finance', 'automobile', 'logistics', 'hotel',
  'diagnostics', 'photography', 'technology', 'agriculture', 'coaching',
];

const emptyForm = { name: '', email: '', password: '', businessName: '', phone: '', industry: '', subdomain: '' };

interface Vendor {
  id: string;
  name: string;
  businessName: string;
  email: string;
  phone: string | null;
  industry: string | null;
  subdomain: string | null;
  customDomain: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  createdAt: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  async function loadVendors() {
    try {
      const res = await api.getVendors();
      setCustomers(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  async function toggleStatus(vendor: Vendor) {
    setActioningId(vendor.id);
    try {
      if (vendor.status === 'SUSPENDED') {
        await api.activateVendor(vendor.id);
      } else {
        await api.suspendVendor(vendor.id);
      }
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  }

  const website = (c: Vendor) => c.customDomain ?? (c.subdomain ? `https://${c.subdomain}.get4domain.com` : null);

  function openCreate() {
    setForm(emptyForm);
    setCreateSuccess(false);
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createVendor(form);
      setCreateSuccess(true);
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Vendors</h2>
          <p className="mt-1 text-sm text-slate-400">{customers.length} vendor{customers.length !== 1 ? 's' : ''}.</p>
        </div>
        <Button size="sm" leftIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={openCreate}>Create Vendor</Button>
      </div>

      {error && (
        <div className="rounded-xl border border-error-800 bg-error-950/50 px-4 py-3 text-sm text-error-400">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map((c) => {
            const site = website(c);
            const isActioning = actioningId === c.id;
            return (
              <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-base font-bold text-white">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-base font-bold text-white">{c.name}</div>
                      <div className="text-sm text-slate-400">{c.businessName}{c.industry ? ` · ${c.industry}` : ''}</div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      </div>
                    </div>
                  </div>
                  {c.status === 'ACTIVE' ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-success-500/20 px-3 py-1 text-xs font-semibold text-success-400 border border-success-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />Active
                    </span>
                  ) : c.status === 'SUSPENDED' ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-error-500/20 px-3 py-1 text-xs font-semibold text-error-400 border border-error-500/30">
                      Suspended
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-warning-500/20 px-3 py-1 text-xs font-semibold text-warning-400 border border-warning-500/30">
                      Pending
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mb-5">
                  <div className="rounded-xl bg-slate-800 px-3 py-2.5">
                    <div className="text-xs text-slate-500 mb-0.5">Customer since</div>
                    <div className="text-sm font-semibold text-white">{new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="rounded-xl bg-slate-800 px-3 py-2.5">
                    <div className="text-xs text-slate-500 mb-0.5">Website</div>
                    <div className="text-sm font-semibold text-white truncate">{site ?? 'Not set up yet'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {site && (
                    <a href={site} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" leftIcon={<Globe className="h-3.5 w-3.5" />} className="bg-primary-600 hover:bg-primary-700 text-white">
                        View Website
                      </Button>
                    </a>
                  )}
                  <a href={`mailto:${c.email}`}>
                    <Button size="sm" leftIcon={<Mail className="h-3.5 w-3.5" />} className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600">
                      Email Client
                    </Button>
                  </a>
                  <Link href="/admin/invoices">
                    <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} variant="outline"
                      className="border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white">
                      View Invoices
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    loading={isActioning}
                    leftIcon={<Ban className="h-3.5 w-3.5" />}
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:border-error-500 hover:text-error-400"
                    onClick={() => toggleStatus(c)}
                  >
                    {c.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
            <Plus className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">New customers appear here after they book a demo and subscribe.</p>
            <Link href="/admin/leads">
              <Button size="sm" variant="outline" className="mt-4 border-slate-700 text-slate-400 hover:border-primary-500 hover:text-primary-400">
                View Demo Bookings
              </Button>
            </Link>
          </div>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Vendor" maxWidth="max-w-lg">
        {createSuccess ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-900">Vendor created — credentials emailed</p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Business Name</label>
                <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Email</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Temporary Password</label>
                <input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Industry</label>
                <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Subdomain</label>
                <div className="flex items-center gap-2">
                  <input value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} placeholder="businessname"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  <span className="text-xs text-slate-400 whitespace-nowrap">.get4domain.com</span>
                </div>
              </div>
            </div>
            <Button type="submit" fullWidth loading={creating}>Create Vendor & Send Welcome Email</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
