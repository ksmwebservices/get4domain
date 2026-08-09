'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, FileText, Link2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { type IndustryConfig } from '@/lib/dashboard-config';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from './EmptyState';

interface Contact { id: string; name: string }
interface LineItem { description: string; quantity: number; rate: number }
interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  createdAt: string;
  contact?: Contact;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com';

const statusTone = (s: string): 'success' | 'warning' | 'neutral' =>
  s === 'PAID' ? 'success' : s === 'PENDING' ? 'warning' : 'neutral';

export default function InvoicingView({ industry, actionLabel = 'Invoice' }: { industry: IndustryConfig; actionLabel?: string }) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactId, setContactId] = useState('');
  const [gstRate, setGstRate] = useState(18);
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, rate: 0 }]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.daGetInvoices();
      setRows(res.data.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setContactId(''); setGstRate(18); setItems([{ description: '', quantity: 1, rate: 0 }]);
    setModalOpen(true);
    if (contacts.length === 0) {
      try { const c = await api.daGetContacts('?limit=100'); setContacts(c.data.items ?? []); } catch { /* noop */ }
    }
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const total = subtotal + (subtotal * gstRate) / 100;

  const save = async () => {
    if (!contactId || items.some((i) => !i.description)) return;
    setSaving(true);
    try {
      await api.daCreateInvoice({ contactId, items, gstRate });
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const viewPdf = async (id: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('g4d_token') : null;
      const res = await fetch(`${API_BASE}/domainapp/invoices/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const html = await res.text();
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      window.open(url, '_blank');
    } catch {
      alert('Failed to open invoice');
    }
  };

  const sendLink = async (id: string) => {
    setBusyId(id);
    try {
      const res = await api.daSendInvoiceLink(id);
      const link = res.data?.paymentLink;
      if (link) window.prompt('Payment link (copy to share):', link);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create payment link');
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (id: string) => {
    setBusyId(id);
    try { await api.daMarkInvoicePaid(id); await load(); } finally { setBusyId(null); }
  };

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (r) => <span className="font-medium text-slate-900">{r.invoiceNumber}</span> },
    { key: 'contact', header: 'Billed To', render: (r) => r.contact?.name ?? '—' },
    { key: 'total', header: 'Total', align: 'right', render: (r) => `₹${(r.total ?? 0).toLocaleString('en-IN')}` },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    {
      key: 'actions', header: '', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button title="View" onClick={(e) => { e.stopPropagation(); viewPdf(r.id); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><FileText className="h-4 w-4" /></button>
          <button title="Payment link" disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); sendLink(r.id); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600"><Link2 className="h-4 w-4" /></button>
          {r.status !== 'PAID' && (
            <button title="Mark paid" disabled={busyId === r.id} onClick={(e) => { e.stopPropagation(); markPaid(r.id); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-success-600"><CheckCircle2 className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500">GST-compliant invoices for your {industry.entities.contact.labelPlural.toLowerCase()}</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Generate {actionLabel}</Button>
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id}
            empty={<EmptyState icon="Receipt" title="No invoices yet"
              subtitle="Generate your first invoice." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Generate {actionLabel}</Button>} />} />
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Generate ${actionLabel}`} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <Select label="Bill To" required value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select {industry.entities.contact.label.toLowerCase()}…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Line items</div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1"><Input placeholder="Description" value={it.description}
                    onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="w-16"><Input type="number" placeholder="Qty" value={it.quantity}
                    onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} /></div>
                  <div className="w-24"><Input type="number" placeholder="Rate" value={it.rate}
                    onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, rate: Number(e.target.value) } : x))} /></div>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setItems([...items, { description: '', quantity: 1, rate: 0 }])} className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700">+ Add item</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="GST %" type="number" value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
            <div className="flex items-end">
              <div className="w-full rounded-xl bg-slate-50 px-4 py-2.5 text-right">
                <span className="text-xs text-slate-500">Total</span>
                <div className="text-lg font-bold text-slate-900">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Generate {actionLabel}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
