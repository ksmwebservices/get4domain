'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck2, CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface CaseRef { id: string; title: string; clientName: string; caseType: string }
interface DocItem { id: string; name: string; required: boolean; status: string; case?: CaseRef | null }

const DOC_STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: 'Pending', color: '#f59e0b', icon: Circle },
  received: { label: 'Received', color: '#16a34a', icon: CheckCircle2 },
  waived: { label: 'Waived', color: '#94a3b8', icon: MinusCircle },
};

export default function DocumentsView() {
  const [rows, setRows] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | string>('pending');

  const load = useCallback(() => {
    setLoading(true);
    api.getCaseDocuments().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    pending: rows.filter((d) => d.status === 'pending').length,
    received: rows.filter((d) => d.status === 'received').length,
    waived: rows.filter((d) => d.status === 'waived').length,
  }), [rows]);
  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((d) => d.status === filter)), [rows, filter]);

  async function cycle(d: DocItem) {
    const next = d.status === 'pending' ? 'received' : d.status === 'received' ? 'waived' : 'pending';
    await api.updateCaseDocument(d.id, { status: next });
    load();
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Documents</h1><p className="mt-0.5 text-sm text-slate-500">Every required document across cases — chase what&apos;s outstanding.</p></div>

      <div className="grid grid-cols-3 gap-3">
        {(['pending', 'received', 'waived'] as const).map((k) => {
          const st = DOC_STATUS[k];
          return (
            <button key={k} onClick={() => setFilter(filter === k ? 'all' : k)} className={`rounded-2xl border p-4 text-left transition ${filter === k ? 'border-primary-300 bg-primary-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className="text-2xl font-extrabold" style={{ color: st.color }}>{counts[k]}</div>
              <div className="text-xs font-semibold text-slate-500">{st.label}</div>
            </button>
          );
        })}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : filtered.length === 0 ? <Card padded><EmptyState icon="FileCheck2" title={rows.length ? 'Nothing here' : 'No documents yet'} subtitle={rows.length ? 'No documents in this state.' : 'Documents appear as you open cases.'} /></Card>
        : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const ds = DOC_STATUS[d.status] ?? DOC_STATUS.pending; const Icon = ds.icon;
              return (
                <Card key={d.id} padded className="flex items-center justify-between gap-3">
                  <button onClick={() => cycle(d)} className="flex min-w-0 items-center gap-3 text-left">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: ds.color }} />
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${d.status === 'waived' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{d.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {d.case ? <>{d.case.title} · {d.case.clientName}</> : 'Unlinked'}
                        {d.case && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{d.case.caseType}</span>}
                      </div>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.required && <span className="text-[10px] uppercase tracking-wide text-slate-400">req</span>}
                    <Badge color={ds.color}>{ds.label}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
