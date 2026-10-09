'use client';

import { useState } from 'react';
import { useLoad } from '@/bos/client';
import { Btn, Msg, Pill, Spin, Table, adm, card, field, useAct, when } from './ui';

interface Job { id: string; vendorId: string; businessName?: string; channel: string; scheduledFor: string; theme: string | null; status: string; manualTarget: string | null; content: { caption: string; guided?: string; source?: string } }
interface PlanRow { id: string; vendorId: string; status: string; killSwitch: boolean; autoApprove: boolean; manualUntil: string | null; profile: { businessName: string; city: string; category: string } | null; jobs: Record<string, number> }
interface Account { id: string; ownerType: string; channel: string; name: string; theme: string | null; city: string | null; category: string | null; status: string; hasToken: boolean; dailyCap: number; lastError: string | null }
interface PostRow { id: string; accountId: string; status: string; content: string; scheduledFor: string; error: string | null; postUrl: string | null }
interface SitemapTask { url: string; pages: number; lastDoneAt: string | null; steps: string[] }
const CHANNELS = ['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS'];

/** Promotion: the approval queue, the manual task list (Facebook Groups, Google Business Profile), plans and kill switches, Get4Domain's own pages and channels, and the post log. */
export default function PromotionTab() {
  const queue = useLoad(() => adm<Job[]>('/admin/leadspace/promotion/queue'), []);
  const tasks = useLoad(() => adm<Job[]>('/admin/leadspace/promotion/tasks'), []);
  const plans = useLoad(() => adm<PlanRow[]>('/admin/leadspace/promotion/plans'), []);
  const accounts = useLoad(() => adm<Account[]>('/admin/social/accounts?ownerType=PLATFORM'), []);
  const posts = useLoad(() => adm<PostRow[]>('/admin/social/posts?take=40'), []);
  const sitemap = useLoad(() => adm<SitemapTask>('/admin/leadspace/promotion/sitemap-task'), []);
  const settings = useLoad(() => adm<{ globalKillSwitch: boolean; channelDailyCaps: Record<string, number> }>('/admin/leadspace/promotion/status').catch(() => null), []);
  const { msg, busy, act } = useAct(() => { queue.reload(); tasks.reload(); plans.reload(); accounts.reload(); posts.reload(); sitemap.reload(); settings.reload(); });
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [acc, setAcc] = useState({ channel: 'FACEBOOK_PAGE', name: '', externalId: '', theme: '', city: '', category: '', token: '', sandbox: true });
  const ids = Object.keys(picked).filter((k) => picked[k]);

  return (
    <div className="space-y-6">
      {msg && <Msg tone={msg.tone}>{msg.text}</Msg>}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="text-sm text-slate-200">Global kill switch: <Pill tone={settings.data?.globalKillSwitch ? 'red' : 'green'}>{settings.data?.globalKillSwitch ? 'ON: nothing is being posted' : 'off'}</Pill></div>
        <div className="flex gap-2">
          <Btn tone={settings.data?.globalKillSwitch ? 'primary' : 'danger'} busy={busy === 'gk'} onClick={() => act('gk', () => adm('/admin/leadspace/promotion/global-kill', { method: 'PUT', body: { on: !settings.data?.globalKillSwitch } }), settings.data?.globalKillSwitch ? 'Posting resumed.' : 'Everything is paused.')}>{settings.data?.globalKillSwitch ? 'Resume posting' : 'Stop all posting'}</Btn>
          <Btn tone="ghost" busy={busy === 'run'} onClick={() => act('run', async () => { await adm('/admin/leadspace/promotion/run', { method: 'POST', body: {} }); await adm('/admin/social/run', { method: 'POST', body: {} }); }, 'Approved posts scheduled and due posts sent.')}>Run now</Btn>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Waiting for approval ({queue.data?.length ?? 0})</h3>{ids.length > 0 && <Btn busy={busy === 'ap'} onClick={() => act('ap', async () => { const r = await adm<{ approved: number; refused: string[] }>('/admin/leadspace/promotion/approve', { method: 'POST', body: { ids } }); setPicked({}); if (r.refused.length) throw new Error(`${r.approved} approved. ${r.refused[0]}`); }, 'Approved. Posts for connected accounts are scheduled.')}>Approve {ids.length} selected</Btn>}</div>
        {queue.loading && !queue.data ? <Spin /> : (queue.data ?? []).length === 0 ? <div className={`${card} text-sm text-slate-500`}>Nothing waiting.</div> : (
          <ul className="space-y-2">
            {(queue.data ?? []).map((j) => (
              <li key={j.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><input type="checkbox" aria-label="Select" checked={Boolean(picked[j.id])} onChange={(e) => setPicked({ ...picked, [j.id]: e.target.checked })} /><span className="font-semibold text-white">{j.businessName}</span><Pill>{j.channel === 'MANUAL' ? 'by hand' : j.channel}</Pill><span>{when(j.scheduledFor)}</span>{j.theme && <span>· {j.theme}</span>}{j.content.source === 'ai' && <Pill tone="blue">AI text</Pill>}{j.manualTarget && <span className="text-amber-300">· {j.manualTarget}</span>}</div>
                <textarea className={field} rows={4} aria-label="Post text" value={edit[j.id] ?? j.content.caption} onChange={(e) => setEdit({ ...edit, [j.id]: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  {edit[j.id] !== undefined && edit[j.id] !== j.content.caption && <Btn tone="ghost" busy={busy === `e${j.id}`} onClick={() => act(`e${j.id}`, async () => { await adm(`/admin/leadspace/promotion/jobs/${j.id}/edit`, { method: 'PUT', body: { caption: edit[j.id] } }); setEdit((x) => { const n = { ...x }; delete n[j.id]; return n; }); }, 'Text saved (checked against the guardrails).')}>Save text</Btn>}
                  <Btn busy={busy === `a${j.id}`} onClick={() => act(`a${j.id}`, async () => { const r = await adm<{ approved: number; refused: string[] }>('/admin/leadspace/promotion/approve', { method: 'POST', body: { ids: [j.id] } }); if (!r.approved) throw new Error(r.refused[0] ?? 'Not approved.'); }, 'Approved.')}>Approve</Btn>
                  <Btn tone="danger" busy={busy === `x${j.id}`} onClick={() => act(`x${j.id}`, () => adm(`/admin/leadspace/promotion/jobs/${j.id}/reject`, { method: 'PUT', body: { note: 'Rejected by admin' } }), 'Rejected.')}>Reject</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Manual tasks ({tasks.data?.length ?? 0})</h3>
        <p className="text-xs text-slate-400">Facebook Groups cannot be posted by API, and a vendor’s Google Business Profile needs their permission first. Copy the text, post it by hand, press Done.</p>
        {(tasks.data ?? []).length === 0 ? <div className={`${card} text-sm text-slate-500`}>No tasks.</div> : (
          <ul className="space-y-2">
            {(tasks.data ?? []).map((t) => (
              <li key={t.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span className="font-semibold text-white">{t.businessName}</span><span>{when(t.scheduledFor)}</span><span className="text-amber-300">{t.manualTarget}</span></div>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm text-slate-200">{t.content.caption}</pre>
                {t.content.guided && <p className="text-xs text-slate-400">{t.content.guided}</p>}
                <div className="flex gap-2"><Btn tone="ghost" onClick={() => { void navigator.clipboard?.writeText(t.content.caption); }}>Copy text</Btn><Btn busy={busy === `t${t.id}`} onClick={() => act(`t${t.id}`, () => adm(`/admin/leadspace/promotion/tasks/${t.id}/done`, { method: 'POST', body: {} }), 'Done.')}>Done</Btn></div>
              </li>
            ))}
          </ul>
        )}
        {sitemap.data && (
          <div className={`${card} space-y-1`}>
            <div className="text-sm font-semibold text-white">Search: submit the sitemap</div>
            <p className="text-xs text-slate-400">{sitemap.data.pages} verified page(s) are in <span className="font-mono">{sitemap.data.url}</span>. {sitemap.data.lastDoneAt ? `Last marked done ${when(sitemap.data.lastDoneAt)}.` : 'Not submitted yet.'}</p>
            <ol className="list-decimal pl-5 text-xs text-slate-300">{sitemap.data.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <Btn tone="ghost" busy={busy === 'sm'} onClick={() => act('sm', () => adm('/admin/leadspace/promotion/sitemap-task/done', { method: 'POST', body: {} }), 'Recorded.')}>Done</Btn>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Vendor plans and kill switches</h3>
        <Table head={['Vendor', 'Plan', 'Posts', 'Switches']} empty={(plans.data ?? []).length === 0 ? 'No vendor has switched promotion on yet.' : undefined}>
          {(plans.data ?? []).map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2"><div className="font-semibold text-white">{p.profile?.businessName ?? p.vendorId.slice(-6)}</div><div className="text-xs text-slate-500">{p.profile?.city} · {p.profile?.category}</div></td>
              <td className="px-3 py-2"><Pill tone={p.status === 'ACTIVE' ? 'green' : 'grey'}>{p.status}</Pill>{p.killSwitch && <Pill tone="red">killed</Pill>}</td>
              <td className="px-3 py-2 text-xs text-slate-300">{Object.entries(p.jobs).map(([k, v]) => `${k.toLowerCase().replace('_', ' ')}: ${v}`).join(' · ')}</td>
              <td className="px-3 py-2"><div className="flex gap-1.5"><Btn tone={p.killSwitch ? 'primary' : 'danger'} onClick={() => act(`k${p.id}`, () => adm(`/admin/leadspace/promotion/vendors/${p.vendorId}/kill`, { method: 'PUT', body: { on: !p.killSwitch } }), p.killSwitch ? 'Promotion can resume for this vendor.' : 'Stopped for this vendor; waiting posts were cancelled.')}>{p.killSwitch ? 'Resume' : 'Kill'}</Btn><Btn tone="ghost" onClick={() => act(`au${p.id}`, () => adm(`/admin/leadspace/promotion/vendors/${p.vendorId}/auto-approve`, { method: 'PUT', body: { on: !p.autoApprove } }), p.autoApprove ? 'Posts need approval again.' : 'After the manual weeks, posts go out without approval.')}>{p.autoApprove ? 'Auto-approve on' : 'Auto-approve off'}</Btn></div></td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Get4Domain’s own pages and channels</h3>
        <Table head={['Account', 'Theme', 'Status', 'Daily cap']} empty={(accounts.data ?? []).length === 0 ? 'No account yet. Posts for vendors become manual tasks until one exists for their city and trade.' : undefined}>
          {(accounts.data ?? []).map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2"><div className="font-semibold text-white">{a.name}</div><div className="text-xs text-slate-500">{a.channel}</div></td>
              <td className="px-3 py-2 text-xs text-slate-300">{a.theme ?? ''}<br />{[a.city, a.category].filter(Boolean).join(' · ') || 'general'}</td>
              <td className="px-3 py-2"><Pill tone={a.status === 'CONNECTED' ? 'green' : a.status === 'SANDBOX' ? 'blue' : a.status === 'DISCONNECTED' ? 'red' : 'amber'}>{a.status}</Pill>{a.hasToken && <span className="ml-1 text-xs text-slate-500">token saved</span>}{a.lastError && <div className="text-xs text-red-300">{a.lastError}</div>}</td>
              <td className="px-3 py-2"><div className="flex items-center gap-1.5">{a.dailyCap}{a.status !== 'SANDBOX' && <Btn tone="ghost" busy={busy === `ts${a.id}`} onClick={() => act(`ts${a.id}`, async () => { const r = await adm<{ ok: boolean; message: string }>(`/admin/social/accounts/${a.id}/test`, { method: 'POST', body: {} }); if (!r.ok) throw new Error(r.message); }, 'The network accepted the token.')}>Test</Btn>}{a.status !== 'DISCONNECTED' && <Btn tone="ghost" onClick={() => act(`dc${a.id}`, () => adm(`/admin/social/accounts/${a.id}`, { method: 'DELETE' }), 'Disconnected. The token was removed.')}>Disconnect</Btn>}</div></td>
            </tr>
          ))}
        </Table>
        <div className={`${card} grid gap-2 md:grid-cols-4`}>
          <select className={field} value={acc.channel} onChange={(e) => setAcc({ ...acc, channel: e.target.value })} aria-label="Channel">{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input className={field} placeholder="Name, e.g. Chennai Home Services Deals" aria-label="Account name" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} autoComplete="off" />
          <input className={field} placeholder="Page id / channel handle" aria-label="Account id" value={acc.externalId} onChange={(e) => setAcc({ ...acc, externalId: e.target.value })} autoComplete="off" />
          <input className={field} placeholder="Theme" aria-label="Theme" value={acc.theme} onChange={(e) => setAcc({ ...acc, theme: e.target.value })} autoComplete="off" />
          <input className={field} placeholder="City (blank = any)" aria-label="City" value={acc.city} onChange={(e) => setAcc({ ...acc, city: e.target.value })} autoComplete="off" />
          <input className={field} placeholder="Trade (blank = any)" aria-label="Trade" value={acc.category} onChange={(e) => setAcc({ ...acc, category: e.target.value })} autoComplete="off" />
          <input className={field} type="password" placeholder="Access token (saved encrypted, never shown again)" aria-label="Access token" value={acc.token} onChange={(e) => setAcc({ ...acc, token: e.target.value })} autoComplete="new-password" />
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={acc.sandbox} onChange={(e) => setAcc({ ...acc, sandbox: e.target.checked })} /> Test mode (nothing leaves the machine)</label>
          <Btn busy={busy === 'newacc'} disabled={!acc.name.trim()} onClick={() => act('newacc', async () => { await adm('/admin/social/accounts', { method: 'PUT', body: { ownerType: 'PLATFORM', channel: acc.channel, name: acc.name.trim(), ...(acc.externalId.trim() ? { externalId: acc.externalId.trim() } : {}), ...(acc.theme.trim() ? { theme: acc.theme.trim() } : {}), ...(acc.city.trim() ? { city: acc.city.trim() } : {}), ...(acc.category.trim() ? { category: acc.category.trim() } : {}), ...(acc.token ? { token: acc.token } : {}), ...(acc.sandbox ? { status: 'SANDBOX' } : {}) } }); setAcc({ ...acc, name: '', externalId: '', theme: '', token: '' }); }, 'Account saved.')}>Save account</Btn>
        </div>
        <div className={`${card} space-y-2`}>
          <div className="text-sm font-semibold text-white">Daily post caps per account, by channel</div>
          <div className="flex flex-wrap gap-2">{Object.entries(settings.data?.channelDailyCaps ?? {}).map(([c, n]) => (
            <label key={c} className="flex items-center gap-1.5 text-xs text-slate-300">{c}<input className={`${field} w-16`} inputMode="numeric" aria-label={`${c} daily cap`} value={edit[`cap${c}`] ?? String(n)} onChange={(e) => setEdit({ ...edit, [`cap${c}`]: e.target.value.replace(/\D/g, '') })} autoComplete="off" /></label>
          ))}</div>
          <Btn tone="ghost" busy={busy === 'caps'} onClick={() => act('caps', async () => { const caps = Object.fromEntries(Object.entries(settings.data?.channelDailyCaps ?? {}).map(([c, n]) => [c, Number(edit[`cap${c}`] ?? n)])); await adm('/admin/leadspace/promotion/caps', { method: 'PUT', body: { caps } }); }, 'Daily caps saved.')}>Save caps</Btn>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Post log</h3>
        <Table head={['When', 'Status', 'Text', 'Result']} empty={(posts.data ?? []).length === 0 ? 'Nothing scheduled yet.' : undefined}>
          {(posts.data ?? []).map((p) => <tr key={p.id}><td className="px-3 py-2 text-xs">{when(p.scheduledFor)}</td><td className="px-3 py-2"><Pill tone={p.status === 'POSTED' ? 'green' : p.status === 'FAILED' ? 'red' : 'grey'}>{p.status}</Pill></td><td className="max-w-xs truncate px-3 py-2 text-xs text-slate-300">{p.content}</td><td className="px-3 py-2 text-xs">{p.postUrl ? <a className="text-sky-400 underline" href={p.postUrl} target="_blank" rel="noopener noreferrer">open</a> : ''}{p.error ? <span className="text-red-300">{p.error}</span> : ''}</td></tr>)}
        </Table>
      </section>
    </div>
  );
}
