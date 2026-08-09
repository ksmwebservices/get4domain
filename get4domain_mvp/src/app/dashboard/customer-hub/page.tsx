'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Send, UserCircle, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/domainapp/shared/EmptyState';

interface Contact { id: string; name: string; phone: string; email?: string; portalAccess?: boolean }

export default function CustomerHubPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [portalOn, setPortalOn] = useState(true);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/customer` : '/customer';

  const load = useCallback(() => {
    setLoading(true);
    api.daGetContacts('?limit=100').then((res) => setContacts(res.data.items ?? [])).catch(() => setContacts([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const invite = async (id: string) => {
    setInvitingId(id);
    try {
      const res = await api.customerInvite(id);
      alert(res.data?.mock ? 'Invite queued (mock — WhatsApp/SMS gateway pending).' : 'Invite sent.');
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, portalAccess: true } : c)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Customer Hub</h1>
        <p className="text-sm text-slate-500">Give your customers a self-service portal for records &amp; invoices.</p>
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Customer Portal</div>
            <div className="text-xs text-slate-500">Phone + OTP login — no password needed.</div>
          </div>
          <button
            onClick={() => setPortalOn((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${portalOn ? 'bg-primary-600' : 'bg-slate-300'}`}
            aria-label="Toggle portal"
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${portalOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {portalOn && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{portalUrl}</code>
            <Button variant="outline" size="sm" leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <a href={portalUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" leftIcon={<ExternalLink className="h-4 w-4" />}>Open</Button>
            </a>
          </div>
        )}
      </Card>

      <h2 className="mb-3 text-sm font-bold text-slate-900">Send portal invites</h2>
      {loading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : contacts.length === 0 ? (
        <EmptyState icon="Users" title="No contacts yet" subtitle="Add contacts in your DomainApp workspace first." />
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Card key={c.id} className="flex items-center justify-between" padded>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><UserCircle className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.phone}</div>
                </div>
              </div>
              {c.portalAccess ? (
                <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">Invited</span>
              ) : (
                <Button size="sm" variant="outline" loading={invitingId === c.id} leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => invite(c.id)}>Invite</Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
