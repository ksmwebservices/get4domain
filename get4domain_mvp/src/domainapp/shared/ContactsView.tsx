'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { type IndustryConfig } from '@/lib/dashboard-config';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from './EmptyState';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type?: string;
  address?: string;
  notes?: string;
}

export default function ContactsView({ industry, icon }: { industry: IndustryConfig; icon: string }) {
  const label = industry.entities.contact.label;
  const labelPlural = industry.entities.contact.labelPlural;

  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.daGetContacts(params);
      setRows(res.data.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({}); setModalOpen(true); };
  const openEdit = (c: Contact) => { setEditing(c); setForm(c); setModalOpen(true); };

  const save = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone, email: form.email, address: form.address, notes: form.notes };
      if (editing) await api.daUpdateContact(editing.id, payload);
      else await api.daCreateContact(payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Contact>[] = [
    { key: 'name', header: label, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email', render: (r) => r.email || <span className="text-slate-400">—</span> },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{labelPlural}</h1>
          <p className="text-sm text-slate-500">Manage your {labelPlural.toLowerCase()}</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${labelPlural.toLowerCase()}…`}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={openEdit}
            empty={<EmptyState icon={icon} title={`No ${labelPlural.toLowerCase()} yet`}
              subtitle={`Add your first ${label.toLowerCase()} to get started.`}
              action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>} />}
          />
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${label}` : `New ${label}`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Input label="Name" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" required value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : `Create ${label}`}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
