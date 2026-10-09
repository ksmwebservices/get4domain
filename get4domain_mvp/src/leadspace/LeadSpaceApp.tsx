'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Home, Megaphone, Users, Wallet } from 'lucide-react';
import HomeTab from './HomeTab';
import LeadsTab from './LeadsTab';
import PageTab from './PageTab';
import PromoteTab from './PromoteTab';
import WalletTab from './WalletTab';

export const TABS = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'leads', label: 'Leads', Icon: Users },
  { key: 'page', label: 'Page', Icon: Globe },
  { key: 'promote', label: 'Promote', Icon: Megaphone },
  { key: 'wallet', label: 'Wallet', Icon: Wallet },
] as const;
export type TabKey = (typeof TABS)[number]['key'];

/**
 * LeadSpace: five tabs. In `app` mode (a LeadSpace-only vendor) the tabs are a bar at the bottom of the phone; in `embedded` mode (a vendor who also has
 * the full dashboard, Marketing and Growth > LeadSpace) they sit at the top of the page. The tab is kept in the address so a refresh lands on the same tab.
 */
export default function LeadSpaceApp({ mode = 'app' }: { mode?: 'app' | 'embedded' }) {
  const [tab, setTabState] = useState<TabKey>('home');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && TABS.some((t) => t.key === q)) setTabState(q as TabKey);
  }, []);
  const setTab = useCallback((k: TabKey) => {
    setTabState(k);
    const u = new URL(window.location.href); u.searchParams.set('tab', k); window.history.replaceState(null, '', u.toString());
    window.scrollTo({ top: 0 });
  }, []);
  /** Something changed that other tabs show (a refill, a status): they reload when opened. */
  const changed = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <div className={mode === 'app' ? 'mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-4 md:pb-8' : 'mx-auto max-w-4xl pb-24 md:pb-4'}>
      <div role="tablist" aria-label="LeadSpace" className="mb-4 hidden gap-1 rounded-xl bg-slate-100 p-1 md:flex">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      <div key={`${tab}-${version}`}>
        {tab === 'home' && <HomeTab go={setTab} />}
        {tab === 'leads' && <LeadsTab go={setTab} onChange={changed} />}
        {tab === 'page' && <PageTab go={setTab} onChange={changed} />}
        {tab === 'promote' && <PromoteTab go={setTab} onChange={changed} />}
        {tab === 'wallet' && <WalletTab onChange={changed} />}
      </div>

      <nav aria-label="LeadSpace" className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-slate-200 bg-white md:hidden">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${tab === key ? 'text-primary-600' : 'text-slate-500'}`}>
            <Icon className="h-5 w-5" aria-hidden />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}
