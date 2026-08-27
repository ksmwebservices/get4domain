'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Order {
  id: string; patientName: string; status: string; sampleId?: string; reportUrl?: string; amount: number; referringDoctor?: string;
}

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

export default function ReportsView() {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getTestOrders().then((r) => setRows(r.data ?? [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const processing = useMemo(() => rows.filter((o) => o.status === 'processing'), [rows]);
  const ready = useMemo(() => rows.filter((o) => o.status === 'report_ready'), [rows]);

  async function markReady(o: Order) { await api.updateTestOrder(o.id, { status: 'report_ready' }); load(); }
  async function setUrl(o: Order) {
    const url = prompt('Report link (URL):', o.reportUrl ?? '');
    if (url === null) return;
    await api.updateTestOrder(o.id, { reportUrl: url });
    load();
  }

  const Row = ({ o, ready: isReady }: { o: Order; ready: boolean }) => (
    <Card padded className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isReady ? 'bg-success-50 text-success-600' : 'bg-gold-50 text-gold-600'}`}>{isReady ? <CheckCircle2 className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">{o.patientName}</div>
          <div className="truncate text-xs text-slate-500">{o.sampleId ? `#${o.sampleId}` : 'No sample id'}{o.referringDoctor && ` · ${o.referringDoctor}`}{o.amount > 0 && ` · ${inr(o.amount)}`}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isReady ? (
          <>
            {o.reportUrl && <Badge color="#16a34a">Linked</Badge>}
            <Button size="sm" variant="outline" leftIcon={<LinkIcon className="h-3.5 w-3.5" />} onClick={() => setUrl(o)}>{o.reportUrl ? 'Edit link' : 'Add link'}</Button>
          </>
        ) : (
          <Button size="sm" onClick={() => markReady(o)}>Mark report ready</Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-bold text-slate-900">Reports</h1><p className="mt-0.5 text-sm text-slate-500">Report delivery — what&apos;s processing and what&apos;s ready to hand over.</p></div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
        : processing.length === 0 && ready.length === 0 ? <Card padded><EmptyState icon="FileText" title="No reports in progress" subtitle="Orders appear here once samples move to processing." /></Card>
        : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Loader2 className="h-4 w-4 text-gold-500" />Processing <span className="text-slate-400">· {processing.length}</span></div>
              {processing.length === 0 ? <p className="text-xs text-slate-400">Nothing processing.</p> : <div className="space-y-2">{processing.map((o) => <Row key={o.id} o={o} ready={false} />)}</div>}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 className="h-4 w-4 text-success-500" />Report ready <span className="text-slate-400">· {ready.length}</span></div>
              {ready.length === 0 ? <p className="text-xs text-slate-400">No reports ready.</p> : <div className="space-y-2">{ready.map((o) => <Row key={o.id} o={o} ready />)}</div>}
            </div>
          </div>
        )}
    </div>
  );
}
