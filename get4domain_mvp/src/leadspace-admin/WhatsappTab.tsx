'use client';

import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, useAct, when } from './ui';

interface Template { name: string; category: string; language: string; body: string; approvalStatus: string; providerTemplateId: string | null }
interface Status { provider: string; sandbox: boolean; status: 'Live' | 'Awaiting approval'; approvedTemplates: number; templates: Template[] }
interface LogRow { id: string; template: string; toMasked: string; vendorId: string | null; status: string; error: string | null; createdAt: string }
interface Outbox { sandbox: boolean; messages: { template: string; to: string; variables: string[]; at: string }[] }

const SAMPLE: Record<string, string> = {
  leadspace_otp: '482913 is your verification code. It is valid for 5 minutes. Do not share this code with anyone.',
  leadspace_new_lead: 'New enquiry for Ravi Plumbing: Priya Kumar, a message. Tap to chat with the customer: https://wa.me/919876543210',
  leadspace_held_leads: '2 new customer(s) are waiting for Ravi Plumbing. Refill your LeadSpace wallet to see their details: https://get4domain.com/dashboard',
  leadspace_low_balance: 'Your LeadSpace wallet for Ravi Plumbing is low: Rs 200 left. Refill to keep receiving customers: https://get4domain.com/dashboard',
  leadspace_refill_receipt: 'Thank you. Rs 1,999 was added to the LeadSpace wallet of Ravi Plumbing. Your tax invoice INV-2026-0042 has been e-mailed.',
};

/** The common Get4Domain WhatsApp number: live status, the five templates and their approval, what was sent. */
export default function WhatsappTab() {
  const st = useLoad(() => adm<Status>('/admin/leadspace/whatsapp'), []);
  const log = useLoad(() => adm<LogRow[]>('/admin/leadspace/whatsapp/log'), []);
  const box = useLoad(() => adm<Outbox>('/admin/leadspace/whatsapp/outbox'), []);
  const { msg, busy, act } = useAct(() => { st.reload(); log.reload(); box.reload(); });

  return (
    <div className="space-y-6">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      {st.loading && !st.data ? <Spin /> : st.data && (
        <>
          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <div className="text-sm text-slate-300">Common number status</div>
              <div className="mt-1 text-xl font-bold text-white"><Pill tone={st.data.status === 'Live' ? 'green' : 'amber'}>{st.data.status}</Pill> <span className="ml-2 text-sm font-normal text-slate-400">provider: {st.data.provider}{st.data.sandbox ? ' (test mode: nothing is sent to customers)' : ''}</span></div>
              <p className="mt-1 text-xs text-slate-400">It turns Live only when the Meta credentials are set on the server and the verification-code template below is Approved. Until then customers cannot receive codes, so the page cannot take verified leads from real customers.</p>
            </div>
          </div>
          <Table head={['Template', 'Kind', 'Sample message', 'Meta approval']}>
            {st.data.templates.map((t) => (
              <tr key={t.name} className="align-top">
                <td className="px-3 py-2"><div className="font-mono text-xs text-white">{t.name}</div><div className="text-[11px] text-slate-500">{t.language}</div></td>
                <td className="px-3 py-2 text-xs">{t.category}</td>
                <td className="max-w-md px-3 py-2 text-xs text-slate-300"><div className="text-slate-500">Template text</div>{t.body}<div className="mt-1 text-slate-500">Sample</div>{SAMPLE[t.name] ?? ''}</td>
                <td className="px-3 py-2">
                  <select className={`${field} w-36`} value={t.approvalStatus} aria-label={`Approval of ${t.name}`} disabled={busy === t.name}
                    onChange={(e) => act(t.name, () => adm(`/admin/leadspace/whatsapp/templates/${t.name}`, { method: 'PUT', body: { approvalStatus: e.target.value } }), `${t.name} marked ${e.target.value}.`)}>
                    <option value="SANDBOX">Sandbox</option><option value="PENDING">Pending (submitted)</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {box.data?.sandbox && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-white">Test mode outbox</h3>
          <p className="text-xs text-slate-400">What the system would have sent. Use it to test a pilot before Meta approves the number: it shows the verification codes.</p>
          <Table head={['When', 'To', 'Template', 'Values']} empty={box.data.messages.length === 0 ? 'Nothing sent since the server started.' : undefined}>
            {box.data.messages.map((m, i) => <tr key={i}><td className="px-3 py-2 text-xs">{when(m.at)}</td><td className="px-3 py-2 font-mono text-xs">{m.to}</td><td className="px-3 py-2 text-xs">{m.template}</td><td className="px-3 py-2 font-mono text-xs">{m.variables.join(' | ')}</td></tr>)}
          </Table>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Messages from the common number</h3>
        <Table head={['When', 'To (masked)', 'Template', 'Vendor', 'Result']} empty={(log.data ?? []).length === 0 ? 'No messages yet.' : undefined}>
          {(log.data ?? []).slice(0, 80).map((m) => <tr key={m.id}><td className="px-3 py-2 text-xs">{when(m.createdAt)}</td><td className="px-3 py-2 font-mono text-xs">{m.toMasked}</td><td className="px-3 py-2 text-xs">{m.template}</td><td className="px-3 py-2 text-xs">{m.vendorId?.slice(-6) ?? ''}</td><td className="px-3 py-2"><Pill tone={m.status === 'DELIVERED' || m.status === 'SENT' ? 'green' : m.status === 'REFUSED' ? 'amber' : 'red'}>{m.status}</Pill>{m.error && <div className="text-xs text-slate-500">{m.error}</div>}</td></tr>)}
        </Table>
        <Btn tone="ghost" onClick={() => { log.reload(); box.reload(); }}>Refresh</Btn>
      </section>
    </div>
  );
}
