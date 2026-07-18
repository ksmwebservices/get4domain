'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Upload, Plus, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';

interface Vendor {
  id: string;
  name: string;
  businessName: string;
  industry: string | null;
}

interface Invoice {
  vendorId: string;
  description: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
}

interface PostLogEntry {
  vendorId: string;
  note: string;
  loggedAt: string;
}

export default function CampaignsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [ideasVendor, setIdeasVendor] = useState<Vendor | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [postLog, setPostLog] = useState<PostLogEntry[]>([]);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.getVendors(), api.getInvoices()])
      .then(([vendorsRes, invoicesRes]) => {
        setVendors(vendorsRes.data ?? []);
        setInvoices(invoicesRes.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const campaignVendors = vendors.filter((v) =>
    invoices.some((i) => i.vendorId === v.id && i.status === 'PAID' && /domaincampaign/i.test(i.description)),
  );

  async function generateIdeas(vendor: Vendor) {
    setIdeasVendor(vendor);
    setIdeasLoading(true);
    setIdeas([]);
    try {
      const res = await api.chat({
        message: `Generate 10 social media post ideas for a ${vendor.industry ?? 'small business'} business called "${vendor.businessName}". Return only a numbered list, one idea per line, no extra commentary.`,
        context: 'dashboard',
      });
      const text: string = res.data?.reply ?? '';
      const lines = text.split('\n').map((l) => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
      setIdeas(lines);
    } catch {
      setIdeas(['Could not generate ideas right now — try again shortly.']);
    } finally {
      setIdeasLoading(false);
    }
  }

  function logPost(vendorId: string) {
    const note = noteDraft[vendorId]?.trim();
    if (!note) return;
    setPostLog((prev) => [{ vendorId, note, loggedAt: new Date().toLocaleDateString('en-IN') }, ...prev]);
    setNoteDraft((prev) => ({ ...prev, [vendorId]: '' }));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Campaign Management</h2>
        <p className="mt-1 text-sm text-slate-400">{campaignVendors.length} vendor{campaignVendors.length !== 1 ? 's' : ''} on DomainCampaign.</p>
      </div>

      {campaignVendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-500 text-sm">No vendors on DomainCampaign yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaignVendors.map((v) => (
            <div key={v.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="text-sm font-bold text-white">{v.businessName}</div>
                  <div className="text-xs text-slate-400">{v.name}{v.industry ? ` · ${v.industry}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => generateIdeas(v)}>Generate Content Ideas</Button>
                  <Button size="sm" variant="outline" leftIcon={<Upload className="h-3.5 w-3.5" />} disabled
                    className="border-slate-700 text-slate-500 cursor-not-allowed" title="File upload storage not yet connected">
                    Upload Report
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={noteDraft[v.id] ?? ''}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  placeholder="Log what was posted today..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
                />
                <Button size="sm" variant="outline" leftIcon={<Plus className="h-3.5 w-3.5" />} className="border-slate-700 text-slate-300" onClick={() => logPost(v.id)}>Log</Button>
              </div>

              {postLog.filter((p) => p.vendorId === v.id).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {postLog.filter((p) => p.vendorId === v.id).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="h-3 w-3 text-success-500 flex-shrink-0" />
                      <span className="text-slate-300">{p.note}</span>
                      <span className="text-slate-600">· {p.loggedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!ideasVendor} onClose={() => setIdeasVendor(null)} title={`Content Ideas — ${ideasVendor?.businessName ?? ''}`} maxWidth="max-w-lg">
        {ideasLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : (
          <ol className="space-y-2 list-decimal list-inside text-sm text-slate-700">
            {ideas.map((idea, i) => <li key={i}>{idea}</li>)}
          </ol>
        )}
      </Modal>
    </div>
  );
}
