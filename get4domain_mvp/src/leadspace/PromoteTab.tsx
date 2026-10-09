'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { dateShort, plain, useLoad } from '@/bos/client';
import { Alert, Empty, ErrorView, Field, Spinner, inputCls } from '@/bos/ui';
import { JOB_STATUS_LABEL, PROMO_CHANNEL_LABEL, ls, type PromoteData, type PromoteJob } from './ls';
import type { TabKey } from './LeadSpaceApp';

const CHANNELS = ['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS', 'FACEBOOK_GROUPS'];

function Job({ j }: { j: PromoteJob }) {
  const impressions = (j.results as { impressions?: number } | null)?.impressions;
  const clicks = (j.results as { clicks?: number } | null)?.clicks;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{PROMO_CHANNEL_LABEL[j.channel] ?? j.channel} · {dateShort(j.scheduledFor)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{JOB_STATUS_LABEL[j.status] ?? j.status}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{j.caption}</p>
      {(j.postUrl || impressions !== undefined) && (
        <p className="mt-1 text-xs text-slate-500">
          {j.postUrl && <a href={j.postUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">See the post</a>}
          {impressions !== undefined && <span>{j.postUrl ? ' · ' : ''}{impressions} seen{clicks !== undefined ? `, ${clicks} taps` : ''}</span>}
        </p>
      )}
    </li>
  );
}

/** Promote: switch Get4Domain's promotion on or off, choose where and how often, and watch what went out. Posts and results are read only. */
export default function PromoteTab({ go, onChange }: { go: (t: TabKey) => void; onChange: () => void }) {
  const q = useLoad(() => ls<PromoteData>('/leadspace/promote'), []);
  const [channels, setChannels] = useState<string[] | null>(null);
  const [perWeek, setPerWeek] = useState<number | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [change, setChange] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  if (q.loading && !q.data) return <Spinner />;
  if (q.error && !q.data) {
    return q.error.status === 404 ? <Empty title="Create your page first" action={<Button size="sm" onClick={() => go('page')}>Create my page</Button>}>Promotion works for a page that is live and verified.</Empty> : <ErrorView error={q.error} />;
  }
  const d = q.data as PromoteData;
  const ch = channels ?? d.channels;
  const wk = perWeek ?? d.perWeek;
  const of = offer ?? d.offer ?? '';

  async function act(label: string, fn: () => Promise<unknown>, ok: string): Promise<void> {
    setBusy(label); setMsg(null);
    try { await fn(); setMsg({ tone: 'ok', text: ok }); setChannels(null); setPerWeek(null); setOffer(null); q.reload(); onChange(); } catch (e) { setMsg({ tone: 'error', text: plain(e) }); } finally { setBusy(''); }
  }
  const toggle = (c: string): void => setChannels((cur) => { const base = cur ?? d.channels; return base.includes(c) ? base.filter((x) => x !== c) : [...base, c]; });
  const settings = { channels: ch, perWeek: wk, offer: of.trim() };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Promote</h1>
        <p className="mt-1 text-sm text-slate-500">We post about your business on our own themed pages for your city and trade, and send people to your page. You do not need an account on any network.</p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {d.killSwitch && <Alert>Promotion for your page is paused by our team. Write to support if you want to know why.</Alert>}

      <Card padded>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Promotion is {d.on ? 'on' : 'off'}</div>
            {!d.on && !d.canTurnOn && d.whyNot && <p className="mt-1 text-sm text-slate-600">{d.whyNot}</p>}
            {d.on && d.manualUntil && new Date(d.manualUntil) > new Date() && <p className="mt-1 text-xs text-slate-500">Our team approves your first posts until {dateShort(d.manualUntil)}.</p>}
          </div>
          <Button variant={d.on ? 'outline' : 'primary'} disabled={d.killSwitch || (!d.on && !d.canTurnOn)} loading={busy === 'toggle'}
            onClick={() => act('toggle', () => ls('/leadspace/promote', { method: 'PUT', body: { on: !d.on, ...(d.on ? {} : settings) } }), d.on ? 'Promotion is off.' : 'Promotion is on. Write your first month of posts below.')}>
            {d.on ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
        {!d.on && !d.canTurnOn && d.whyNot && /Verify|Publish/.test(d.whyNot) && <div className="mt-3"><Button size="sm" variant="outline" onClick={() => go('page')}>Open my page</Button></div>}
      </Card>

      <Card padded className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">Where and how often</div>
        <div className="space-y-2" role="group" aria-label="Where to promote">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={ch.includes(c)} onChange={() => toggle(c)} /> {PROMO_CHANNEL_LABEL[c]}</label>
          ))}
        </div>
        <Field label="Posts a week"><select className={inputCls} value={wk} onChange={(e) => setPerWeek(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
        <Field label="Offer to promote (optional)" hint="Only an offer you also show on your page."><input className={inputCls} value={of} onChange={(e) => setOffer(e.target.value)} maxLength={240} autoComplete="off" /></Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={busy === 'save'} onClick={() => act('save', () => ls('/leadspace/promote', { method: 'PUT', body: settings }), 'Saved.')}>Save</Button>
          {d.on && <Button loading={busy === 'calendar'} onClick={() => act('calendar', () => ls('/leadspace/promote/calendar', { method: 'POST', body: { days: 30 } }), 'The next month of posts is written. Our team checks them before they go out.')}>Write next month&apos;s posts</Button>}
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Coming up</h2>
        {d.upcoming.length === 0 ? <Empty title="Nothing scheduled">{d.on ? 'Press "Write next month\'s posts" above.' : 'Turn promotion on to see the plan here.'}</Empty> : <ul className="space-y-2">{d.upcoming.slice(0, 20).map((j) => <Job key={j.id} j={j} />)}</ul>}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Posted</h2>
        {d.posted.length === 0 ? <p className="text-sm text-slate-500">Nothing has been posted yet.</p> : <ul className="space-y-2">{d.posted.slice(0, 20).map((j) => <Job key={j.id} j={j} />)}</ul>}
      </section>

      <Card padded className="space-y-2">
        <div className="text-sm font-semibold text-slate-900">Want something changed?</div>
        <p className="text-sm text-slate-600">Posts are written and approved by our team. Tell us what to change and we will do it.</p>
        <textarea className={inputCls} rows={2} maxLength={400} value={change} onChange={(e) => setChange(e.target.value)} placeholder="For example: promote the geyser offer first" aria-label="Change request" />
        <Button size="sm" variant="outline" disabled={change.trim().length < 5} loading={busy === 'change'} onClick={() => act('change', async () => { await ls('/leadspace/promote/change-request', { method: 'POST', body: { text: change.trim() } }); setChange(''); }, 'Sent. We will get back to you.')}>Send to our team</Button>
      </Card>
    </div>
  );
}
