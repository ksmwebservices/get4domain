'use client';

import Link from 'next/link';
import { ArrowRight, Rocket } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { rupees, useLoad } from '@/bos/client';
import { Empty, ErrorView, Spinner, Stat } from '@/bos/ui';
import { planDisplayName } from '@/lib/nav.generated';
import { ls, type PromoteData, type Summary } from './ls';
import { useState } from 'react';
import { plain } from '@/bos/client';
import { Alert } from '@/bos/ui';
import type { TabKey } from './LeadSpaceApp';

type Home = Summary & { upgradeSuggested?: boolean; upgradeThreshold?: number; todayBookings?: number; todayOrders?: number };

/** One next action, chosen from what is true right now. */
function nextAction(s: Home, promo: PromoteData | null): { text: string; button: string; tab: TabKey } {
  if (!s.page) return { text: 'Create your page. It takes about two minutes and costs nothing.', button: 'Create my page', tab: 'page' };
  if (s.page.status === 'SUSPENDED') return { text: 'Your page is suspended. Open the Page tab to see why and what to do.', button: 'See details', tab: 'page' };
  if (s.page.status !== 'PUBLISHED') return { text: 'Your page is not live yet. Add your services and publish it.', button: 'Finish my page', tab: 'page' };
  if (s.page.verificationStatus !== 'VERIFIED') return { text: 'Verify your phone number so search engines can show your page and we can promote it.', button: 'Verify my number', tab: 'page' };
  if (s.held > 0) return { text: `${s.held} customer${s.held === 1 ? ' is' : 's are'} waiting for you. Refill your wallet to see their details.`, button: 'Refill wallet', tab: 'wallet' };
  if (s.delivered - s.contacted > 0) return { text: `${s.delivered - s.contacted} new lead${s.delivered - s.contacted === 1 ? '' : 's'} to contact. The first call decides who gets the work.`, button: 'Open my leads', tab: 'leads' };
  if (s.balancePaise <= 0) return { text: 'Your wallet is empty. Your page keeps working and new customers are held for you; refill to see them.', button: 'Refill wallet', tab: 'wallet' };
  if (promo && !promo.on) return { text: 'Let us promote your page on our themed pages for your city and trade.', button: 'Set up promotion', tab: 'promote' };
  return { text: 'All good. Share your page link with customers, or keep an eye on the Leads tab.', button: 'See my leads', tab: 'leads' };
}

interface LegacyPlan { page: { action: string }; campaigns: { toImport: number }; leads: { toImport: number } }

export default function HomeTab({ go }: { go: (t: TabKey) => void }) {
  const sum = useLoad(() => ls<Home>('/leadspace/summary'), []);
  const legacy = useLoad(() => ls<LegacyPlan | null>('/leadspace/page/import-legacy').catch(() => null), []);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  async function importLegacy(): Promise<void> {
    setImporting(true); setImportMsg(null);
    try { await ls('/leadspace/page/import-legacy', { method: 'POST', body: {} }); setImportMsg({ tone: 'ok', text: 'Done. Your earlier landing page is now a draft in the Page tab, your campaigns are in Promote and your leads are in Leads. Nothing was deleted.' }); legacy.reload(); sum.reload(); } catch (e) { setImportMsg({ tone: 'error', text: plain(e) }); } finally { setImporting(false); }
  }
  const waiting = legacy.data ? (legacy.data.page.action === 'CREATE' ? 1 : 0) + legacy.data.campaigns.toImport + legacy.data.leads.toImport : 0;
  const promo = useLoad(() => ls<PromoteData>('/leadspace/promote').catch(() => null), []);
  if (sum.loading && !sum.data) return <Spinner />;
  if (sum.error && !sum.data) return <ErrorView error={sum.error} />;
  const s = sum.data as Home;
  const act = nextAction(s, promo.data);
  const pageLive = s.page?.status === 'PUBLISHED';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">LeadSpace</h1>
        <p className="mt-1 text-sm text-slate-500">Customers who asked for you, verified on WhatsApp. You pay only for a verified customer.</p>
      </div>

      <Card padded>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="text-3xl font-extrabold text-slate-900">{rupees(s.balancePaise)}</div>
          <Button size="sm" variant="outline" onClick={() => go('wallet')}>Refill</Button>
        </div>
        {s.held > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{s.held} customer{s.held === 1 ? ' is' : 's are'} waiting. Their details unlock when you refill, oldest first.</p>}
      </Card>

      <Card padded className="border-primary-200 bg-primary-50">
        <div className="flex items-start gap-3">
          <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary-700">Your next step</div>
            <p className="mt-1 text-sm text-slate-800">{act.text}</p>
            <div className="mt-3"><Button size="sm" onClick={() => go(act.tab)} rightIcon={<ArrowRight className="h-4 w-4" />}>{act.button}</Button></div>
          </div>
        </div>
      </Card>

      {waiting > 0 && (
        <Card padded className="border-primary-200 bg-primary-50">
          <div className="text-sm font-semibold text-slate-900">We found your earlier campaigns</div>
          <p className="mt-1 text-sm text-slate-700">Campaigns and landing pages are now part of LeadSpace. Copy what you made before into LeadSpace: your landing page becomes a draft page, your campaigns appear in Promote and your campaign leads in Leads. Nothing is deleted, and your old page address keeps working until you publish the new page.</p>
          <div className="mt-3"><Button size="sm" loading={importing} onClick={importLegacy}>Copy them into LeadSpace</Button></div>
        </Card>
      )}
      {importMsg && <Alert tone={importMsg.tone}>{importMsg.text}</Alert>}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="New today" value={s.today} />
        {(s.todayBookings ?? 0) > 0 && <Stat label="Bookings and visits today" value={s.todayBookings ?? 0} />}
        {(s.todayOrders ?? 0) > 0 && <Stat label="Orders today" value={s.todayOrders ?? 0} />}
        <Stat label="Last 7 days" value={s.last7} />
        <Stat label="Waiting (held)" value={s.held} tone={s.held ? 'warn' : 'default'} />
        <Stat label="Won (all time)" value={s.won} tone={s.won ? 'good' : 'default'} />
        <Stat label="Page views" value={s.pageViews} />
        <Stat label="Spent, last 30 days" value={rupees(s.spentLast30Paise)} />
      </div>

      <Card padded>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Your page</div>
            <div className="text-xs text-slate-500">{!s.page ? 'Not created yet' : pageLive ? 'Live' : 'Draft'}{s.page && s.page.verificationStatus !== 'VERIFIED' ? ' · phone not verified' : ''}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => go('page')}>{s.page ? 'Edit' : 'Create'}</Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Promotion</div>
            <div className="text-xs text-slate-500">{promo.data ? (promo.data.killSwitch ? 'Paused by our team' : promo.data.on ? `On · ${promo.data.upcoming.length} post${promo.data.upcoming.length === 1 ? '' : 's'} coming up` : 'Off') : 'Off'}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => go('promote')}>Open</Button>
        </div>
      </Card>

      {s.upgradeSuggested && (
        <Card padded className="border-secondary-200 bg-secondary-50">
          <div className="text-sm font-semibold text-slate-900">Turn your leads into customers and invoices</div>
          <p className="mt-1 text-sm text-slate-600">You are getting steady leads. {planDisplayName('WORKSPACE')} adds a customer list, quotes, GST invoices and payments so a lead becomes a customer and an invoice in a few taps.</p>
          <div className="mt-3"><Link href="/dashboard/go-live" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 underline">See {planDisplayName('WORKSPACE')} <ArrowRight className="h-4 w-4" /></Link></div>
        </Card>
      )}

      {!s.page && s.last30 === 0 && <Empty title="Nothing yet">When customers ask for you through your page, they appear in the Leads tab.</Empty>}
    </div>
  );
}
