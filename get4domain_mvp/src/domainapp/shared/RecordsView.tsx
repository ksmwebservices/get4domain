'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { type IndustryConfig } from '@/lib/dashboard-config';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Input, Textarea, Select } from '@/components/ui/Input';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from './EmptyState';
import { CustomFieldInputs, CustomFieldDisplay } from './CustomFields';

interface Contact { id: string; name: string; phone?: string }
interface CatalogItem { id: string; name: string; price: number }
interface RecordRow {
  id: string;
  status: string;
  date: string;
  amount: number;
  notes?: string;
  contact?: Contact;
  catalogItem?: CatalogItem;
  contactId?: string;
  catalogItemId?: string;
  customFields?: Record<string, unknown>;
}

export default function RecordsView({ industry, icon }: { industry: IndustryConfig; icon: string }) {
  const label = industry.entities.record.label;
  const labelPlural = industry.entities.record.labelPlural;
  const statuses = industry.recordStatuses;
  const statusMap = useMemo(() => Object.fromEntries(statuses.map((s) => [s.key, s])), [statuses]);

  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<RecordRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.daGetRecords(params);
      setRows(res.data.items ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const ensureRefData = useCallback(async () => {
    if (contacts.length === 0) {
      try { const c = await api.daGetContacts('?limit=100'); setContacts(c.data.items ?? []); } catch { /* noop */ }
    }
    if (catalog.length === 0) {
      try { const c = await api.daGetCatalog('?limit=100'); setCatalog(c.data.items ?? []); } catch { /* noop */ }
    }
  }, [contacts.length, catalog.length]);

  const openCreate = async () => {
    setEditing(null);
    setForm({ status: statuses[0]?.key ?? 'draft', date: new Date().toISOString().slice(0, 10), amount: 0 });
    setCustom({});
    setModalOpen(true);
    await ensureRefData();
  };

  const openEdit = async (r: RecordRow) => {
    setEditing(r);
    setForm({
      contactId: r.contactId ?? r.contact?.id ?? '',
      catalogItemId: r.catalogItemId ?? r.catalogItem?.id ?? '',
      status: r.status,
      date: r.date?.slice(0, 10),
      amount: r.amount,
      notes: r.notes ?? '',
    });
    setCustom(r.customFields ?? {});
    setDetail(null);
    setModalOpen(true);
    await ensureRefData();
  };

  const save = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      const payload = {
        contactId: (form.contactId as string) || undefined,
        catalogItemId: (form.catalogItemId as string) || undefined,
        status: form.status as string,
        date: new Date(form.date as string).toISOString(),
        amount: Number(form.amount ?? 0),
        notes: (form.notes as string) || undefined,
        customFields: custom,
      };
      if (editing) await api.daUpdateRecord(editing.id, payload);
      else await api.daCreateRecord(payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (r: RecordRow, status: string) => {
    setBusy(true);
    try {
      await api.daUpdateRecordStatus(r.id, status);
      setDetail({ ...r, status });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const generateInvoice = async (r: RecordRow) => {
    if (!r.contact?.id && !r.contactId) {
      alert(`Link a ${industry.entities.contact.label.toLowerCase()} before generating an invoice.`);
      return;
    }
    setBusy(true);
    try {
      const desc = r.catalogItem?.name ?? label;
      await api.daCreateInvoice({
        contactId: r.contact?.id ?? r.contactId,
        recordId: r.id,
        items: [{ description: desc, quantity: 1, rate: r.amount || 0 }],
        gstRate: 18,
      });
      alert('Invoice created. Find it under Billing.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<RecordRow>[] = [
    { key: 'contact', header: industry.entities.contact.label, render: (r) => r.contact?.name ?? <span className="text-slate-400">—</span> },
    { key: 'catalogItem', header: industry.entities.catalogItem.label, render: (r) => r.catalogItem?.name ?? <span className="text-slate-400">—</span> },
    { key: 'date', header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => `₹${(r.amount ?? 0).toLocaleString('en-IN')}` },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const s = statusMap[r.status];
        return <Badge color={s?.color}>{s?.label ?? r.status}</Badge>;
      },
    },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{labelPlural}</h1>
          <p className="text-sm text-slate-500">Track and manage your {labelPlural.toLowerCase()}</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>
      </div>

      {/* Status filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter('')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
          All
        </button>
        {statuses.map((s) => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === s.key ? 'text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
            style={statusFilter === s.key ? { backgroundColor: s.color } : { color: s.color }}>
            {s.label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setDetail(r)}
            empty={<EmptyState icon={icon} title={`No ${labelPlural.toLowerCase()} yet`}
              subtitle={`Create your first ${label.toLowerCase()} to get started.`}
              action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>New {label}</Button>} />}
          />
        )}
      </Card>

      {/* Create / edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${label}` : `New ${label}`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Select label={industry.entities.contact.label} value={(form.contactId as string) ?? ''} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
            <option value="">Select…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label={industry.entities.catalogItem.label} value={(form.catalogItemId as string) ?? ''}
            onChange={(e) => {
              const item = catalog.find((c) => c.id === e.target.value);
              setForm({ ...form, catalogItemId: e.target.value, amount: item ? item.price : form.amount });
            }}>
            <option value="">Select…</option>
            {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" required value={(form.date as string) ?? ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input label="Amount (₹)" type="number" value={(form.amount as number) ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <Select label="Status" value={(form.status as string) ?? ''} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <CustomFieldInputs fields={industry.recordCustomFields} values={custom} onChange={(k, v) => setCustom({ ...custom, [k]: v })} />
          <Textarea label="Notes" value={(form.notes as string) ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editing ? 'Save' : `Create ${label}`}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail drawer */}
      <Modal isOpen={detail !== null} onClose={() => setDetail(null)} title={`${label} details`} maxWidth="max-w-lg">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">{industry.entities.contact.label}</div>
                <div className="text-base font-semibold text-slate-900">{detail.contact?.name ?? '—'}</div>
                {detail.contact?.phone && <div className="text-sm text-slate-500">{detail.contact.phone}</div>}
              </div>
              <Badge color={statusMap[detail.status]?.color}>{statusMap[detail.status]?.label ?? detail.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">{industry.entities.catalogItem.label}</div>
                <div className="text-sm font-medium text-slate-800">{detail.catalogItem?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Amount</div>
                <div className="text-sm font-medium text-slate-800">₹{(detail.amount ?? 0).toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Date</div>
                <div className="text-sm font-medium text-slate-800">{new Date(detail.date).toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            <CustomFieldDisplay fields={industry.recordCustomFields} values={detail.customFields ?? {}} />

            {detail.notes && (
              <div>
                <div className="text-xs text-slate-400">Notes</div>
                <div className="text-sm text-slate-700">{detail.notes}</div>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-500">Update status</div>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <button key={s.key} disabled={busy || s.key === detail.status} onClick={() => changeStatus(detail, s.key)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
                    style={{ color: s.color }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => openEdit(detail)}>Edit</Button>
              <Button leftIcon={<FileText className="h-4 w-4" />} loading={busy} onClick={() => generateInvoice(detail)}>
                Generate Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
